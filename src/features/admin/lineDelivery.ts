import type { User } from "firebase/auth";

export type AdminLineFriend = {
  id: string;
  displayName: string;
  pictureUrl: string | null;
  memo: string;
  isDeliverable: boolean;
  isFriend: boolean;
  registeredAt: string | null;
  updatedAt: string | null;
};

type LineFriendsResponse = {
  friends?: AdminLineFriend[];
  message?: string;
};

type SendLineInviteResponse = {
  sentCount?: number;
  failedCount?: number;
  message?: string;
  results?: Array<{
    friendId: string;
    displayName: string;
    ok: boolean;
    message: string;
  }>;
};

export async function fetchAdminLineFriends(user: User) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/admin/line/friends", {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Cache-Control": "no-store"
    }
  });
  const result = (await response.json().catch(() => null)) as LineFriendsResponse | null;

  if (!response.ok || !result) {
    throw new Error(result?.message ?? "LINE友だち一覧の取得に失敗しました。");
  }

  return result.friends ?? [];
}

export async function sendLineInvite({
  user,
  planId,
  eventIds,
  lineFriendIds,
  greeting
}: {
  user: User;
  planId: string;
  eventIds: string[];
  lineFriendIds: string[];
  greeting: string;
}) {
  const idToken = await user.getIdToken();
  const response = await fetch("/api/admin/line/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      planId,
      eventIds,
      lineFriendIds,
      greeting
    })
  });
  const result = (await response.json().catch(() => null)) as
    | SendLineInviteResponse
    | null;

  if (!response.ok || !result) {
    throw new Error(result?.message ?? "LINE配信に失敗しました。");
  }

  return {
    sentCount: result.sentCount ?? 0,
    failedCount: result.failedCount ?? 0,
    results: result.results ?? []
  };
}
