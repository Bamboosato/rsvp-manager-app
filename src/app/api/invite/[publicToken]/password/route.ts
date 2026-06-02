import { NextRequest, NextResponse } from "next/server";
import { verifySecret } from "@/lib/firebase/serverApi";
import { setInvitePasswordSession } from "@/lib/invite/session";
import { findPlanByPublicToken } from "@/lib/invite/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

type PasswordRequest = {
  password?: unknown;
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

    if (!plan.passwordHash) {
      const response = NextResponse.json({ ok: true });
      setInvitePasswordSession(response, {
        kind: "password",
        publicToken,
        planId: plan.id
      });
      return response;
    }

    const body = (await request.json().catch(() => null)) as PasswordRequest | null;
    const password = typeof body?.password === "string" ? body.password : "";

    if (!password || !verifySecret(password, plan.passwordHash)) {
      return NextResponse.json(
        { message: "プランパスワードが正しくありません。" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    setInvitePasswordSession(response, {
      kind: "password",
      publicToken,
      planId: plan.id
    });
    return response;
  } catch (error) {
    console.error("Failed to verify invite password.", error);
    return NextResponse.json(
      { message: "通信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
