import { CoordinatorSubmissionQueue } from "@/components/coordinator/submission-queue";
import { coordinatorQueueInclude, requireCoordinator } from "@/lib/coordinator-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "All submissions" };
export default async function AllSubmissionsPage() {
  const actor = await requireCoordinator();
  const submissions = await prisma.researchSubmission.findMany({ where: { call: { coordinatorId: actor.id } }, include: coordinatorQueueInclude, orderBy: { updatedAt: "desc" }, take: 100 });
  return <CoordinatorSubmissionQueue mode="all" submissions={submissions} reviewers={[]} />;
}
