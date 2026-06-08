import { InviteCompleteScreen } from "@/features/invite/InviteScreens";
import { getInviteShareToken, type InvitePageSearchParams } from "../shareToken";

type PageProps = {
  params: Promise<{ publicToken: string }>;
  searchParams: InvitePageSearchParams;
};

export default async function InviteCompletePage({ params, searchParams }: PageProps) {
  const { publicToken } = await params;
  const shareToken = await getInviteShareToken(searchParams);

  return <InviteCompleteScreen publicToken={publicToken} shareToken={shareToken} />;
}
