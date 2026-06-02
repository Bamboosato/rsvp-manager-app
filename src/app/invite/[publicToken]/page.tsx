import { InviteStartScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ publicToken: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { publicToken } = await params;

  return <InviteStartScreen publicToken={publicToken} />;
}
