import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { buildAppUrl } from "@/lib/appUrl";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverApi";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { createInviteShareToken } from "@/lib/invite/shareTokens";
import { getOwnedDeliverableLineFriends } from "@/lib/line/friends";
import { pushLineText } from "@/lib/line/client";

export const runtime = "nodejs";

type SendLineInviteRequest = {
  planId?: unknown;
  eventIds?: unknown;
  lineFriendIds?: unknown;
  greeting?: unknown;
};

const maxShareEventCount = 100;
const maxLineRecipientCount = 50;
const maxGreetingLength = 500;

export async function POST(request: NextRequest) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | SendLineInviteRequest
    | null;
  const validation = validateSendLineInviteRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  try {
    const db = getFirebaseAdminFirestore();
    const planDocument = await db.collection("plans").doc(validation.planId).get();
    const planData = planDocument.data();

    if (!planDocument.exists || planData?.ownerUid !== authUser.uid) {
      return NextResponse.json({ message: "プランを表示できません。" }, { status: 404 });
    }

    if (planData.isActive !== true) {
      return NextResponse.json(
        { message: "無効化済みプランのURLは共有できません。" },
        { status: 410 }
      );
    }

    const publicToken = typeof planData.publicToken === "string" ? planData.publicToken : "";

    if (!publicToken) {
      return NextResponse.json(
        { message: "配信用URLの作成に失敗しました。" },
        { status: 500 }
      );
    }

    const eventDocuments = await db.getAll(
      ...validation.eventIds.map((eventId) => db.collection("events").doc(eventId))
    );
    const invalidEvent = eventDocuments.find((eventDocument) => {
      const eventData = eventDocument.data();

      return (
        !eventDocument.exists ||
        eventData?.ownerUid !== authUser.uid ||
        eventData.planId !== validation.planId ||
        eventData.isActive !== true ||
        eventData.status !== "accepting"
      );
    });

    if (invalidEvent) {
      return NextResponse.json(
        { message: "選択できないイベントが含まれています。" },
        { status: 400 }
      );
    }

    const friends = await getOwnedDeliverableLineFriends({
      ownerUid: authUser.uid,
      friendIds: validation.lineFriendIds
    });

    if (friends.length !== validation.lineFriendIds.length) {
      return NextResponse.json(
        { message: "配信できないLINE友だちが含まれています。" },
        { status: 400 }
      );
    }

    const inviteCode = await createInviteShareToken({
      ownerUid: authUser.uid,
      planId: validation.planId,
      publicToken,
      eventIds: validation.eventIds
    });
    const inviteUrl = buildAppUrl(`/i/${inviteCode}`, request.nextUrl.origin);
    const messageText = buildLineInviteMessage({
      greeting: validation.greeting,
      inviteUrl
    });
    const results = await Promise.all(
      friends.map(async (friend) => {
        const result = await pushLineText({
          to: friend.lineUserId,
          text: messageText
        });

        await saveLineDeliveryLog({
          ownerUid: authUser.uid,
          planId: validation.planId,
          eventIds: validation.eventIds,
          shareToken: inviteCode,
          friendId: friend.id,
          lineUserId: friend.lineUserId,
          displayName: friend.displayName,
          ok: result.ok,
          status: result.status,
          errorMessage: result.ok ? "" : result.message
        }).catch((error) => {
          console.error("Failed to save LINE delivery log.", error);
        });

        return {
          friendId: friend.id,
          displayName: friend.displayName,
          ok: result.ok,
          status: result.status,
          message: result.message
        };
      })
    );
    const sentCount = results.filter((result) => result.ok).length;
    const failedCount = results.length - sentCount;

    return NextResponse.json({
      inviteCode,
      inviteUrl,
      sentCount,
      failedCount,
      results
    });
  } catch (error) {
    console.error("Failed to send LINE invite.", error);
    return NextResponse.json(
      { message: "LINE配信に失敗しました。" },
      { status: 500 }
    );
  }
}

function validateSendLineInviteRequest(
  body: SendLineInviteRequest | null
):
  | {
      ok: true;
      planId: string;
      eventIds: string[];
      lineFriendIds: string[];
      greeting: string;
    }
  | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  const planId = typeof body.planId === "string" ? body.planId.trim() : "";
  const eventIds = Array.isArray(body.eventIds)
    ? body.eventIds.map((eventId) => (typeof eventId === "string" ? eventId.trim() : ""))
    : [];
  const lineFriendIds = Array.isArray(body.lineFriendIds)
    ? body.lineFriendIds.map((friendId) =>
        typeof friendId === "string" ? friendId.trim() : ""
      )
    : [];
  const greeting = typeof body.greeting === "string" ? body.greeting.trim() : "";

  if (!planId) {
    return { ok: false, message: "プラン情報を確認できません。" };
  }

  if (eventIds.length === 0 || eventIds.some((eventId) => !eventId)) {
    return { ok: false, message: "イベントを選択してください。" };
  }

  if (eventIds.length > maxShareEventCount || new Set(eventIds).size !== eventIds.length) {
    return { ok: false, message: "イベントの選択内容が正しくありません。" };
  }

  if (lineFriendIds.length === 0 || lineFriendIds.some((friendId) => !friendId)) {
    return { ok: false, message: "LINE配信先を選択してください。" };
  }

  if (
    lineFriendIds.length > maxLineRecipientCount ||
    new Set(lineFriendIds).size !== lineFriendIds.length
  ) {
    return { ok: false, message: "LINE配信先の選択内容が正しくありません。" };
  }

  if (greeting.length > maxGreetingLength) {
    return { ok: false, message: "挨拶文は500文字以内で入力してください。" };
  }

  return {
    ok: true,
    planId,
    eventIds,
    lineFriendIds,
    greeting
  };
}

function buildLineInviteMessage({
  greeting,
  inviteUrl
}: {
  greeting: string;
  inviteUrl: string;
}) {
  return [
    greeting,
    inviteUrl
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function saveLineDeliveryLog({
  ownerUid,
  planId,
  eventIds,
  shareToken,
  friendId,
  lineUserId,
  displayName,
  ok,
  status,
  errorMessage
}: {
  ownerUid: string;
  planId: string;
  eventIds: string[];
  shareToken: string;
  friendId: string;
  lineUserId: string;
  displayName: string;
  ok: boolean;
  status: number;
  errorMessage: string;
}) {
  const now = Timestamp.now();

  await getFirebaseAdminFirestore()
    .collection("lineMessageDeliveries")
    .doc(randomUUID())
    .create({
      ownerUid,
      planId,
      eventIds,
      shareToken,
      friendId,
      lineUserId,
      displayName,
      status: ok ? "accepted" : "failed",
      responseStatus: status,
      errorMessage,
      createdAt: now,
      updatedAt: now
    });
}
