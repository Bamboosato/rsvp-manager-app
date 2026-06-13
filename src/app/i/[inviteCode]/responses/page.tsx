import { InviteResponsesScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ inviteCode: string }>;
};

export default async function InviteResponsesPage({ params }: PageProps) {
  const { inviteCode } = await params;

  return <InviteResponsesScreen inviteCode={inviteCode} />;
}
