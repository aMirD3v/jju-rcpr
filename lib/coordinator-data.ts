import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireCoordinator() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role !== "COORDINATOR") redirect(actor.role === "ADMIN" ? "/admin" : actor.role === "REVIEWER" ? "/reviewer" : "/portal");
  return actor;
}

export const coordinatorQueueInclude = {
  call: { select: { title: true } },
  researcher: { select: { name: true, email: true } },
  assignments: {
    where: { supersededAt: null },
    select: { id: true, reviewerId: true, reviewer: { select: { name: true } }, status: true, dueAt: true, review: { select: { submittedAt: true } } },
  },
} satisfies Prisma.ResearchSubmissionInclude;

export async function getCoordinatorReviewers() {
  const reviewers = await prisma.user.findMany({ where: { role: "REVIEWER", isActive: true, emailVerifiedAt: { not: null } }, select: { id: true, name: true, email: true, institution: true, reviewerExpertise: true, maxActiveAssignments: true }, orderBy: { name: "asc" } });
  const workloads = await prisma.reviewerAssignment.groupBy({ by: ["reviewerId"], where: { reviewerId: { in: reviewers.map((reviewer) => reviewer.id) }, supersededAt: null, status: { in: ["PENDING", "ACCEPTED"] } }, _count: { _all: true } });
  const counts = new Map(workloads.map((item) => [item.reviewerId, item._count._all]));
  return reviewers.map((reviewer) => ({ ...reviewer, activeAssignments: counts.get(reviewer.id) ?? 0 }));
}
