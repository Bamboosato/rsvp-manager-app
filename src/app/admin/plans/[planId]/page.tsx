import { PlanDetailScreen } from "@/features/admin/PlanDetailScreen";

export default async function PlanDetailPage({
  params
}: {
  params: Promise<{ planId: string }>;
}) {
  const { planId } = await params;

  return <PlanDetailScreen planId={planId} />;
}
