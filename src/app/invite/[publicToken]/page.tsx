import { InviteStartScreen } from "@/features/invite/InviteScreens";
import { getInviteShareToken, type InvitePageSearchParams } from "./shareToken";

type PageProps = {
  params: Promise<{ publicToken: string }>;
  searchParams: InvitePageSearchParams;
};

export default async function InvitePage({ params, searchParams }: PageProps) {
  const { publicToken } = await params;
  const shareToken = await getInviteShareToken(searchParams);

  return <InviteStartScreen publicToken={publicToken} shareToken={shareToken} />;
}
