import { NextRequest, NextResponse } from "next/server";
import { verifySecret } from "@/lib/firebase/serverApi";
import { setInvitePasswordSession } from "@/lib/invite/session";
import { findPlanByPublicToken } from "@/lib/invite/server";
import {
  findActiveInviteShareTokenForPlan,
  validateInviteShareTokenParam
} from "@/lib/invite/shareTokens";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

type PasswordRequest = {
  accessCode?: unknown;
  password?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { publicToken } = await context.params;
  const shareTokenValidation = validateInviteShareTokenParam(
    request.nextUrl.searchParams.get("share")
  );

  if (!shareTokenValidation.ok) {
    return NextResponse.json(
      { message: shareTokenValidation.message },
      { status: 400 }
    );
  }

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

    const shareToken = await findActiveInviteShareTokenForPlan({
      plan,
      token: shareTokenValidation.token
    });

    if (!shareToken) {
      return NextResponse.json(
        { message: "配信用URLが正しくありません。" },
        { status: 404 }
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
    const accessCode =
      typeof body?.accessCode === "string"
        ? body.accessCode.trim()
        : typeof body?.password === "string"
          ? body.password.trim()
          : "";

    if (!/^\d{6,12}$/.test(accessCode) || !verifySecret(accessCode, plan.passwordHash)) {
      return NextResponse.json(
        { message: "アクセスコードが正しくありません。" },
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
