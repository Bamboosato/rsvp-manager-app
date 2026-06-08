import { NextRequest, NextResponse } from "next/server";
import { findPlanByPublicToken, toPublicPlan } from "@/lib/invite/server";
import {
  findActiveInviteShareTokenForPlan,
  validateInviteShareTokenParam
} from "@/lib/invite/shareTokens";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
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

    return NextResponse.json({ plan: toPublicPlan(plan) });
  } catch (error) {
    console.error("Failed to load invite plan.", error);
    return NextResponse.json(
      { message: "通信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
