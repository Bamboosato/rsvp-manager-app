import { NextRequest, NextResponse } from "next/server";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverApi";
import { registerNotificationToken } from "@/lib/notifications/server";

export const runtime = "nodejs";

type RegisterNotificationTokenRequest = {
  token?: unknown;
  userAgent?: unknown;
};

export async function POST(request: NextRequest) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | RegisterNotificationTokenRequest
    | null;
  const validation = validateRegisterNotificationTokenRequest(body);

  if (!validation.ok) {
    return NextResponse.json({ message: validation.message }, { status: 400 });
  }

  try {
    const tokenId = await registerNotificationToken({
      ownerUid: authUser.uid,
      fcmToken: validation.token,
      userAgent: validation.userAgent
    });

    return NextResponse.json({ tokenId });
  } catch (error) {
    console.error("Failed to register notification token.", error);
    return NextResponse.json(
      { message: "通知設定の保存に失敗しました。" },
      { status: 500 }
    );
  }
}

function validateRegisterNotificationTokenRequest(
  body: RegisterNotificationTokenRequest | null
):
  | {
      ok: true;
      token: string;
      userAgent: string | null;
    }
  | { ok: false; message: string } {
  if (!body) {
    return { ok: false, message: "入力内容が正しくありません。" };
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const userAgent =
    typeof body.userAgent === "string" ? body.userAgent.trim().slice(0, 300) : null;

  if (token.length < 20 || token.length > 4096) {
    return { ok: false, message: "通知トークンが正しくありません。" };
  }

  return {
    ok: true,
    token,
    userAgent: userAgent || null
  };
}
