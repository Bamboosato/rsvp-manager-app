import { EditPlanScreen } from "@/features/admin/EditPlanScreen";

export default async function EditPlanPage({
  params
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  return <EditPlanScreen planId={planId} />;
}
