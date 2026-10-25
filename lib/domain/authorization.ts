import type { Actor } from "./types";

export function requireRole(actor: Actor | null, ...allowed: Actor["role"][]) {
  if (!actor || !allowed.includes(actor.role)) throw new Error("Unauthorized");
  return actor;
}

export function canReadSubmission(actor: Actor, submission: { researcherId: string; reviewerIds: string[] }) {
  return actor.role === "COORDINATOR" || actor.id === submission.researcherId || submission.reviewerIds.includes(actor.id);
}

export function canWriteReview(actor: Actor, assignment: { reviewerId: string; acceptedAt: Date | null }) {
  return actor.role === "REVIEWER" && assignment.reviewerId === actor.id && Boolean(assignment.acceptedAt);
}
