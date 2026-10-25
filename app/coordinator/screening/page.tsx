import { CoordinatorSubmissionQueue } from "@/components/coordinator/submission-queue";
import { coordinatorQueueInclude, requireCoordinator } from "@/lib/coordinator-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Submission screening" };
export default async function ScreeningPage() {
  const actor = await requireCoordinator();
  const submissions = await prisma.researchSubmission.findMany({ where: { call: { coordinatorId: actor.id }, status: "SUBMITTED" }, include: coordinatorQueueInclude, orderBy: { updatedAt: "asc" }, take: 100 });
  return <CoordinatorSubmissionQueue mode="screening" submissions={submissions} reviewers={[]} />;
}
