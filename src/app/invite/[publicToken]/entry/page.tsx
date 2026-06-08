import { InviteEntryScreen } from "@/features/invite/InviteScreens";
import { getInviteShareToken, type InvitePageSearchParams } from "../shareToken";

type PageProps = {
  params: Promise<{ publicToken: string }>;
  searchParams: InvitePageSearchParams;
};

export default async function InviteEntryPage({ params, searchParams }: PageProps) {
  const { publicToken } = await params;
  const shareToken = await getInviteShareToken(searchParams);

  return <InviteEntryScreen publicToken={publicToken} shareToken={shareToken} />;
}
