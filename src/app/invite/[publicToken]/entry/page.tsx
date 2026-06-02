import { InviteEntryScreen } from "@/features/invite/InviteScreens";

type PageProps = {
  params: Promise<{ publicToken: string }>;
};

export default async function InviteEntryPage({ params }: PageProps) {
  const { publicToken } = await params;

  return <InviteEntryScreen publicToken={publicToken} />;
}
