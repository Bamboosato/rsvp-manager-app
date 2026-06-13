import { NextResponse } from "next/server";
import { findActiveInviteByCode } from "@/lib/invite/codeLookup";
import { toPublicPlan } from "@/lib/invite/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ inviteCode: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { inviteCode } = await context.params;

  try {
    const invite = await findActiveInviteByCode(inviteCode);

    if (!invite.ok) {
      return NextResponse.json({ message: invite.message }, { status: invite.status });
    }

    return NextResponse.json({ plan: toPublicPlan(invite.plan) });
  } catch (error) {
    console.error("Failed to load invite plan.", error);
    return NextResponse.json(
      { message: "通信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
