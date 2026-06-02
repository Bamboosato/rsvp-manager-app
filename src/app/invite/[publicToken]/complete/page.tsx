import { InviteCompleteScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ publicToken: string }>;
};

export default async function InviteCompletePage({ params }: PageProps) {
  const { publicToken } = await params;

  return <InviteCompleteScreen publicToken={publicToken} />;
}
