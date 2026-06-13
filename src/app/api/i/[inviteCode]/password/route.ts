import { NextRequest, NextResponse } from "next/server";
import { verifySecret } from "@/lib/firebase/serverApi";
import { findActiveInviteByCode } from "@/lib/invite/codeLookup";
import { setInvitePasswordSession } from "@/lib/invite/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ inviteCode: string }>;
};

type PasswordRequest = {
  accessCode?: unknown;
  password?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { inviteCode } = await context.params;

  try {
    const invite = await findActiveInviteByCode(inviteCode);

    if (!invite.ok) {
      return NextResponse.json({ message: invite.message }, { status: invite.status });
    }

    if (!invite.plan.passwordHash) {
      const response = NextResponse.json({ ok: true });
      setInvitePasswordSession(response, {
        kind: "password",
        inviteCode,
        planId: invite.plan.id
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

    if (!/^\d{6,12}$/.test(accessCode) || !verifySecret(accessCode, invite.plan.passwordHash)) {
      return NextResponse.json(
        { message: "アクセスコードが正しくありません。" },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    setInvitePasswordSession(response, {
      kind: "password",
      inviteCode,
      planId: invite.plan.id
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
