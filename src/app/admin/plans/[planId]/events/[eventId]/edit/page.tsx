import { EditEventScreen } from "@/features/admin/EditEventScreen";

export default async function EditEventPage({
  params
}: {
  params: Promise<{ planId: string; eventId: string }>;
}) {
  const { planId, eventId } = await params;

  return <EditEventScreen planId={planId} eventId={eventId} />;
}
