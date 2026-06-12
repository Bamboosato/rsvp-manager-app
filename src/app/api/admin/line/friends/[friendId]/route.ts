import { NextRequest, NextResponse } from "next/server";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverApi";
import { deleteLineFriend, updateLineFriend } from "@/lib/line/friends";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ friendId: string }>;
};

type UpdateLineFriendRequest = {
  memo?: unknown;
  isDeliverable?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | UpdateLineFriendRequest
    | null;
  const memo = typeof body?.memo === "string" ? body.memo.trim() : "";
  const isDeliverable =
    typeof body?.isDeliverable === "boolean" ? body.isDeliverable : true;

  if (memo.length > 120) {
    return NextResponse.json(
      { message: "メモは120文字以内で入力してください。" },
      { status: 400 }
    );
  }

  try {
    const { friendId } = await context.params;
    const friend = await updateLineFriend({
      ownerUid: authUser.uid,
      friendId,
      memo,
      isDeliverable
    });

    if (!friend) {
      return NextResponse.json(
        { message: "LINE友だちを表示できません。" },
        { status: 404 }
      );
    }

    return NextResponse.json({ friend });
  } catch (error) {
    console.error("Failed to update LINE friend.", error);
    return NextResponse.json(
      { message: "LINE友だちの更新に失敗しました。" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  try {
    const { friendId } = await context.params;
    const ok = await deleteLineFriend({
      ownerUid: authUser.uid,
      friendId
    });

    if (!ok) {
      return NextResponse.json(
        { message: "LINE友だちを表示できません。" },
        { status: 404 }
      );
    }

    return NextResponse.json({ friendId });
  } catch (error) {
    console.error("Failed to delete LINE friend.", error);
    return NextResponse.json(
      { message: "LINE友だちの削除に失敗しました。" },
      { status: 500 }
    );
  }
}
