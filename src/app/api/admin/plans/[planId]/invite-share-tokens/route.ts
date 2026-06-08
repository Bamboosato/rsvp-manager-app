import { NextRequest, NextResponse } from "next/server";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverApi";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { createInviteShareToken } from "@/lib/invite/shareTokens";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

type CreateInviteShareTokenRequest = {
  eventIds?: unknown;
};

const maxShareEventCount = 100;

export async function POST(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | CreateInviteShareTokenRequest
    | null;
  const validation = validateCreateInviteShareTokenRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  const { planId } = await context.params;

  try {
    const db = getFirebaseAdminFirestore();
    const planDocument = await db.collection("plans").doc(planId).get();
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
        eventData.planId !== planId ||
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

    const shareToken = await createInviteShareToken({
      ownerUid: authUser.uid,
      planId,
      publicToken,
      eventIds: validation.eventIds
    });

    return NextResponse.json({ shareToken }, { status: 201 });
  } catch (error) {
    console.error("Failed to create invite share token.", error);
    return NextResponse.json(
      { message: "配信用URLの作成に失敗しました。" },
      { status: 500 }
    );
  }
}

function validateCreateInviteShareTokenRequest(
  body: CreateInviteShareTokenRequest | null
):
  | {
      ok: true;
      eventIds: string[];
    }
  | { ok: false; message: string } {
  if (!body || !Array.isArray(body.eventIds)) {
    return { ok: false, message: "イベントを選択してください。" };
  }

  const eventIds = body.eventIds.map((eventId) =>
    typeof eventId === "string" ? eventId.trim() : ""
  );
  const uniqueEventIds = new Set(eventIds);

  if (eventIds.length === 0 || eventIds.some((eventId) => !eventId)) {
    return { ok: false, message: "イベントを選択してください。" };
  }

  if (eventIds.length > maxShareEventCount) {
    return { ok: false, message: "一度に共有できるイベント数を超えています。" };
  }

  if (uniqueEventIds.size !== eventIds.length) {
    return { ok: false, message: "イベントの選択内容が正しくありません。" };
  }

  return {
    ok: true,
    eventIds
  };
}
