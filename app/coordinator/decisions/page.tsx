import { CoordinatorSubmissionQueue } from "@/components/coordinator/submission-queue";
import { coordinatorQueueInclude, requireCoordinator } from "@/lib/coordinator-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Final decisions" };
export default async function DecisionsPage() {
  const actor = await requireCoordinator();
  const submissions = await prisma.researchSubmission.findMany({ where: { call: { coordinatorId: actor.id }, status: "UNDER_REVIEW" }, include: coordinatorQueueInclude, orderBy: { updatedAt: "asc" }, take: 100 });
  return <CoordinatorSubmissionQueue mode="decisions" submissions={submissions} reviewers={[]} />;
}
