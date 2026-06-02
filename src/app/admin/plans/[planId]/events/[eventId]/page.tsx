import { EventDetailScreen } from "@/features/admin/EventDetailScreen";

export default async function EventDetailPage({
  params
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return <EventDetailScreen eventId={eventId} />;
}
