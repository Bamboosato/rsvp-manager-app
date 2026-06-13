import {
  findActiveInviteShareTokenByCode,
  type InviteShareToken
} from "@/lib/invite/shareTokens";
import { findPlanByPublicToken, type InvitePlan } from "@/lib/invite/server";

export type InviteCodeLookupResult =
  | { ok: true; plan: InvitePlan; shareToken: InviteShareToken }
  | { ok: false; status: 404 | 410; message: string };

export async function findActiveInviteByCode(
  inviteCode: string
): Promise<InviteCodeLookupResult> {
  const shareToken = await findActiveInviteShareTokenByCode(inviteCode);

  if (!shareToken) {
    return {
      ok: false,
      status: 404,
      message: "配信用URLが正しくありません。"
    };
  }

  const plan = await findPlanByPublicToken(shareToken.publicToken);

  if (!plan || plan.id !== shareToken.planId || plan.ownerUid !== shareToken.ownerUid) {
    return {
      ok: false,
      status: 404,
      message: "URLが正しくないか、利用できません。"
    };
  }

  if (!plan.isActive) {
    return {
      ok: false,
      status: 410,
      message: "このプランは現在利用できません。"
    };
  }

  return { ok: true, plan, shareToken };
}
