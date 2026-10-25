import { CoordinatorSubmissionQueue } from "@/components/coordinator/submission-queue";
import { coordinatorQueueInclude, getCoordinatorReviewers, requireCoordinator } from "@/lib/coordinator-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reviewer assignments" };
export default async function AssignmentsPage() {
  const actor = await requireCoordinator();
  const [submissions, reviewers] = await Promise.all([
    prisma.researchSubmission.findMany({ where: { call: { coordinatorId: actor.id }, status: { in: ["ELIGIBLE_FOR_REVIEW", "UNDER_REVIEW"] } }, include: coordinatorQueueInclude, orderBy: { updatedAt: "asc" }, take: 100 }),
    getCoordinatorReviewers(),
  ]);
  return <CoordinatorSubmissionQueue mode="assignments" submissions={submissions} reviewers={reviewers} />;
}
