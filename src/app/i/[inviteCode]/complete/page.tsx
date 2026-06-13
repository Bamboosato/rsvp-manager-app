import { InviteCompleteScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ inviteCode: string }>;
};

export default async function InviteCompletePage({ params }: PageProps) {
  const { inviteCode } = await params;

  return <InviteCompleteScreen inviteCode={inviteCode} />;
}
