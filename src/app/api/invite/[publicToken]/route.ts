import { NextResponse } from "next/server";
import { findPlanByPublicToken, toPublicPlan } from "@/lib/invite/server";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ publicToken: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
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

    return NextResponse.json({ plan: toPublicPlan(plan) });
  } catch (error) {
    console.error("Failed to load invite plan.", error);
    return NextResponse.json(
      { message: "通信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 }
    );
  }
}
