import { NextRequest, NextResponse } from "next/server";
import { authenticateFirebaseRequest } from "@/lib/firebase/serverApi";
import { listLineFriends } from "@/lib/line/friends";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authUser = await authenticateFirebaseRequest(request);

  if (!authUser) {
    return NextResponse.json({ message: "認証情報がありません。" }, { status: 401 });
  }

  try {
    const friends = await listLineFriends(authUser.uid);
    return NextResponse.json(
      { friends },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Failed to list LINE friends.", error);
    return NextResponse.json(
      { message: "LINE友だち一覧の取得に失敗しました。" },
      { status: 500 }
    );
  }
}
