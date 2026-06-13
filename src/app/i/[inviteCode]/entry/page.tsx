import { InviteEntryScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ inviteCode: string }>;
};

export default async function InviteEntryPage({ params }: PageProps) {
  const { inviteCode } = await params;

  return <InviteEntryScreen inviteCode={inviteCode} />;
}
