import { InviteStartScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ inviteCode: string }>;
};

export default async function InvitePage({ params }: PageProps) {
  const { inviteCode } = await params;

  return <InviteStartScreen inviteCode={inviteCode} />;
}
