import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTransition } from "@/lib/domain/workflow";
import { sendUserNotification } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";

const input = z.object({ outcome: z.enum(["ACCEPTED", "REJECTED", "REVISION_REQUESTED"]), feedback: z.string().trim().min(10).max(8000), overrideOutstandingReviews: z.boolean().default(false), overrideReason: z.string().trim().min(20).max(1500).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Coordinator access required." }, { status: 403 });
  const { submissionId } = await params;
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Provide a decision and feedback." }, { status: 400 });
  if (parsed.data.overrideOutstandingReviews && !parsed.data.overrideReason) return NextResponse.json({ error: "An override requires a documented reason." }, { status: 400 });
  const submission = await prisma.researchSubmission.findFirst({ where: { id: submissionId, call: { coordinatorId: actor.id } } });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  if (submission.status !== "UNDER_REVIEW") return NextResponse.json({ error: "Decisions can be recorded only after the submission enters review." }, { status: 409 });
  try { assertTransition(submission.status, parsed.data.outcome, "COORDINATOR"); } catch { return NextResponse.json({ error: "This decision is not permitted from the current status." }, { status: 409 }); }
  const outcome = parsed.data.outcome;
  const result = await prisma.$transaction(async (tx) => {
    const activeAssignments = await tx.reviewerAssignment.findMany({ where: { submissionId, supersededAt: null }, include: { review: true } });
    const reviewsComplete = activeAssignments.length > 0 && activeAssignments.every((a) => a.status === "COMPLETED" && a.review?.submittedAt);
    if (!reviewsComplete && !parsed.data.overrideOutstandingReviews) throw new Error("REVIEWS_OUTSTANDING");
    await tx.reviewerAssignment.updateMany({ where: { submissionId, supersededAt: null }, data: { supersededAt: new Date() } });
    for (const assignment of activeAssignments.filter((item) => item.status !== "COMPLETED")) {
      await tx.notification.create({ data: { userId: assignment.reviewerId, type: "INFO", title: "Review assignment closed", body: `The coordinator has closed the review round for ${submission.referenceNumber}.`, link: "/reviewer" } });
    }
    const updated = await tx.researchSubmission.update({ where: { id: submissionId }, data: { status: outcome, ...(outcome === "REVISION_REQUESTED" ? { currentRound: { increment: 1 } } : {}) } });
    await tx.researchDecision.create({ data: { submissionId, decisionMakerId: actor.id, status: outcome, feedback: parsed.data.feedback, isOverride: !reviewsComplete, overrideReason: !reviewsComplete ? parsed.data.overrideReason : undefined } });
    await tx.workflowEvent.create({ data: { submissionId, actorId: actor.id, eventType: "COORDINATOR_DECISION", fromStatus: submission.status, toStatus: outcome, detail: { feedback: parsed.data.feedback, override: !reviewsComplete, reason: !reviewsComplete ? parsed.data.overrideReason : undefined } } });
    await tx.notification.create({ data: { userId: submission.researcherId, type: "DECISION", title: outcome === "ACCEPTED" ? "Research accepted" : outcome === "REJECTED" ? "Research decision" : "Revision requested", body: parsed.data.feedback, link: "/portal" } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "FINAL_DECISION_RECORDED", resourceType: "ResearchSubmission", resourceId: submissionId, detail: { outcome, override: !reviewsComplete, reason: !reviewsComplete ? parsed.data.overrideReason : undefined } } });
    return updated;
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "REVIEWS_OUTSTANDING") return null;
    throw error;
  });
  if (!result) return NextResponse.json({ error: "All active reviewers must submit their review before a decision." }, { status: 409 });
  await sendUserNotification(submission.researcherId, outcome === "ACCEPTED" ? "Research accepted" : outcome === "REJECTED" ? "Decision recorded" : "Revision requested", parsed.data.feedback, "/portal");
  return NextResponse.json(result);
}
