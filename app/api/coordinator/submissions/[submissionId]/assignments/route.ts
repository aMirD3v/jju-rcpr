import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendUserNotification } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";

const input = z.object({ reviewerId: z.string().min(8), dueAt: z.coerce.date(), replaceAssignmentId: z.string().min(8).optional(), reassignmentReason: z.string().trim().min(10).max(1500).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Coordinator access required." }, { status: 403 });
  const { submissionId } = await params;
  const parsed = input.safeParse(await request.json());
  if (!parsed.success || parsed.data.dueAt <= new Date()) return NextResponse.json({ error: "Provide a reviewer and a future deadline." }, { status: 400 });
  const submission = await prisma.researchSubmission.findFirst({ where: { id: submissionId, call: { coordinatorId: actor.id }, status: { in: ["ELIGIBLE_FOR_REVIEW", "UNDER_REVIEW"] } } });
  if (!submission) return NextResponse.json({ error: "Only eligible submissions can be assigned." }, { status: 409 });
  const reviewer = await prisma.user.findFirst({ where: { id: parsed.data.reviewerId, role: "REVIEWER" } });
  if (!reviewer) return NextResponse.json({ error: "Reviewer account not found." }, { status: 404 });
  if (reviewer.id === submission.researcherId) return NextResponse.json({ error: "A researcher cannot review their own submission." }, { status: 400 });
  if (parsed.data.replaceAssignmentId && !parsed.data.reassignmentReason) return NextResponse.json({ error: "Provide a reason to preserve the reassignment history." }, { status: 400 });
  const replacement = parsed.data.replaceAssignmentId ? await prisma.reviewerAssignment.findFirst({ where: { id: parsed.data.replaceAssignmentId, submissionId, supersededAt: null } }) : null;
  if (parsed.data.replaceAssignmentId && !replacement) return NextResponse.json({ error: "The assignment selected for replacement is no longer active." }, { status: 409 });
  if (replacement?.status === "COMPLETED") return NextResponse.json({ error: "A completed review cannot be reassigned." }, { status: 409 });
  const currentAssignments = await prisma.reviewerAssignment.findMany({ where: { submissionId, supersededAt: null, ...(replacement ? { id: { not: replacement.id } } : {}) } });
  if (currentAssignments.some((assignment) => assignment.reviewerId === reviewer.id)) return NextResponse.json({ error: "This reviewer already has an active assignment." }, { status: 409 });
  const result = await prisma.$transaction(async (tx) => {
    const currentSubmission = await tx.researchSubmission.findFirst({ where: { id: submissionId, call: { coordinatorId: actor.id }, status: { in: ["ELIGIBLE_FOR_REVIEW", "UNDER_REVIEW"] } }, select: { id: true } });
    if (!currentSubmission) throw new Error("SUBMISSION_CHANGED");
    const currentReplacement = replacement ? await tx.reviewerAssignment.findFirst({ where: { id: replacement.id, submissionId, supersededAt: null } }) : null;
    if (replacement && !currentReplacement) throw new Error("ASSIGNMENT_CHANGED");
    if (currentReplacement?.status === "COMPLETED") throw new Error("ASSIGNMENT_COMPLETED");
    const duplicate = await tx.reviewerAssignment.findFirst({ where: { submissionId, reviewerId: reviewer.id, supersededAt: null, ...(currentReplacement ? { id: { not: currentReplacement.id } } : {}) }, select: { id: true } });
    if (duplicate) throw new Error("DUPLICATE_ASSIGNMENT");
    await tx.reviewerAssignment.updateMany({ where: { submissionId, supersededAt: null, status: { in: ["CONFLICT_DECLARED", "DECLINED"] } }, data: { supersededAt: new Date() } });
    if (currentReplacement) await tx.reviewerAssignment.update({ where: { id: currentReplacement.id }, data: { supersededAt: new Date() } });
    const assignment = await tx.reviewerAssignment.create({ data: { submissionId, reviewerId: reviewer.id, assignedById: actor.id, dueAt: parsed.data.dueAt } });
    if (submission.status === "ELIGIBLE_FOR_REVIEW") await tx.researchSubmission.update({ where: { id: submissionId }, data: { status: "UNDER_REVIEW" } });
    await tx.workflowEvent.create({ data: { submissionId, actorId: actor.id, eventType: currentReplacement ? "REVIEWER_REASSIGNED" : "REVIEWER_ASSIGNED", fromStatus: submission.status, toStatus: "UNDER_REVIEW", detail: { assignmentId: assignment.id, replacedAssignmentId: currentReplacement?.id, reason: parsed.data.reassignmentReason, dueAt: assignment.dueAt } } });
    await tx.notification.create({ data: { userId: reviewer.id, type: "ACTION_REQUIRED", title: "Review assignment", body: `A research submission has been assigned to you. Please respond by ${parsed.data.dueAt.toLocaleDateString()}.`, link: "/reviewer" } });
    if (currentReplacement) await tx.notification.create({ data: { userId: currentReplacement.reviewerId, type: "INFO", title: "Review assignment withdrawn", body: `Your assignment for ${submission.referenceNumber} has been withdrawn by the coordinator.`, link: "/reviewer" } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: currentReplacement ? "REVIEWER_REASSIGNED" : "REVIEWER_ASSIGNED", resourceType: "ResearchSubmission", resourceId: submissionId, detail: { reviewerId: reviewer.id, assignmentId: assignment.id, replacedAssignmentId: currentReplacement?.id, reason: parsed.data.reassignmentReason } } });
    return assignment;
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    if (error instanceof Error && ["SUBMISSION_CHANGED", "ASSIGNMENT_CHANGED", "ASSIGNMENT_COMPLETED", "DUPLICATE_ASSIGNMENT"].includes(error.message)) return null;
    throw error;
  });
  if (!result) return NextResponse.json({ error: "The assignment changed while this request was being processed. Refresh the workspace and try again." }, { status: 409 });
  await sendUserNotification(reviewer.id, "Review assignment", "A research submission has been assigned to you. Please respond by " + parsed.data.dueAt.toLocaleDateString() + ".", "/reviewer");
  return NextResponse.json(result, { status: 201 });
}
