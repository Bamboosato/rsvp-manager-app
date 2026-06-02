import { NewEventScreen } from "@/features/admin/NewEventScreen";

export default async function NewEventPage({
  params
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  return <NewEventScreen planId={planId} />;
}
