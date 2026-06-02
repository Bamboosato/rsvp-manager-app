import { InviteResponsesScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ publicToken: string }>;
};

export default async function InviteResponsesPage({ params }: PageProps) {
  const { publicToken } = await params;

  return <InviteResponsesScreen publicToken={publicToken} />;
}
