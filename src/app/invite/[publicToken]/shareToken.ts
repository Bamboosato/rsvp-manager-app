export type InvitePageSearchParams = Promise<{
  share?: string | string[];
}>;

export async function getInviteShareToken(searchParams: InvitePageSearchParams) {
  const params = await searchParams;
  const share = params.share;

  return Array.isArray(share) ? (share[0] ?? "") : (share ?? "");
}
