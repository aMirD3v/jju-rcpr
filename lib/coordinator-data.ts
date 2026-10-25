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
  return prisma.user.findMany({ where: { role: "REVIEWER" }, select: { id: true, name: true, email: true, institution: true }, orderBy: { name: "asc" } });
}
