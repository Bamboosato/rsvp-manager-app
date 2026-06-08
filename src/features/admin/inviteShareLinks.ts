import type { User } from "firebase/auth";
import { buildAppUrl } from "@/lib/appUrl";
import type { AdminPlan } from "./plans/data";

type CreateInviteShareTokenResponse = {
  shareToken?: string;
  message?: string;
};

export async function createInviteShareUrl({
  user,
  plan,
  eventIds
}: {
  user: User;
  plan: AdminPlan;
  eventIds: string[];
}) {
  const idToken = await user.getIdToken();
  const response = await fetch(`/api/admin/plans/${plan.id}/invite-share-tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ eventIds })
  });
  const result = (await response.json().catch(() => null)) as
    | CreateInviteShareTokenResponse
    | null;

  if (!response.ok || !result?.shareToken) {
    throw new Error(result?.message ?? "配信用URLの作成に失敗しました。");
  }

  return buildAppUrl(
    `/invite/${plan.publicToken}?share=${encodeURIComponent(result.shareToken)}`
  );
}
