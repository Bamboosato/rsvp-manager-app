import { NextRequest, NextResponse } from "next/server";
import { readInvitePasswordSession, setInviteSession } from "@/lib/invite/session";
import {
  createInviteGuest,
  findGuestByNickname,
  findPlanByPublicToken,
  verifyGuestPin
} from "@/lib/invite/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

type EntryRequest = {
  nickname?: unknown;
  pin?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { publicToken } = await context.params;

  try {
    const plan = await findPlanByPublicToken(publicToken);

    if (!plan) {
      return NextResponse.json(
        { message: "URLが正しくないか、利用できません。" },
        { status: 404 }
      );
    }

    if (!plan.isActive) {
      return NextResponse.json(
        { message: "このプランは現在利用できません。" },
        { status: 410 }
      );
    }

    if (plan.passwordHash) {
      const passwordSession = readInvitePasswordSession(request, publicToken);

      if (!passwordSession || passwordSession.planId !== plan.id) {
        return NextResponse.json(
          { message: "アクセスコードを入力してください。" },
          { status: 401 }
        );
      }
    }

    const body = (await request.json().catch(() => null)) as EntryRequest | null;
    const validation = validateEntryRequest(body);

    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }

    const existingGuest = await findGuestByNickname({
      ownerUid: plan.ownerUid,
      planId: plan.id,
      nickname: validation.nickname
    });
    const guest = existingGuest
      ? existingGuest
      : await createInviteGuest({
          ownerUid: plan.ownerUid,
          planId: plan.id,
          nickname: validation.nickname,
          pin: validation.pin
        });

    if (existingGuest && !verifyGuestPin(existingGuest, validation.pin)) {
      return NextResponse.json(
        {
          message:
            "同じニックネームは既に使用されています。PINを忘れた場合は管理者へ連絡してください。"
        },
        { status: 409 }
      );
    }

    const response = NextResponse.json({
      guest: {
        nickname: guest.nickname
      }
    });
    setInviteSession(response, {
      kind: "invite",
      publicToken,
      planId: plan.id,
      ownerUid: plan.ownerUid,
      guestId: guest.id,
      nickname: guest.nickname
    });
    return response;
  } catch (error) {
    console.error("Failed to create invite entry session.", error);
    return NextResponse.json(
      { message: "通信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}

function validateEntryRequest(body: EntryRequest | null):
  | { ok: true; nickname: string; pin: string }
  | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin.trim() : "";

  if (!nickname) {
    return { ok: false, message: "ニックネームを入力してください。" };
  }

  if (nickname.length > 40) {
    return { ok: false, message: "ニックネームは40文字以内で入力してください。" };
  }

  if (!/^\d{4}$/.test(pin)) {
    return { ok: false, message: "PINは4桁の数字で入力してください。" };
  }

  return { ok: true, nickname, pin };
}
