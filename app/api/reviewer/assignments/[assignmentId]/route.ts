import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendUserNotification } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";

const assignmentAction = z.discriminatedUnion("action", [z.object({ action: z.literal("ACCEPT") }), z.object({ action: z.literal("CONFLICT"), conflictNote: z.string().trim().min(10).max(1500) })]);
const reviewInput = z.object({ originality: z.number().int().min(1).max(5), relevance: z.number().int().min(1).max(5), researchQuality: z.number().int().min(1).max(5), methodology: z.number().int().min(1).max(5), clarity: z.number().int().min(1).max(5), authorComments: z.string().trim().min(40).max(12000), confidentialComments: z.string().trim().max(12000).optional(), recommendation: z.enum(["ACCEPT", "MINOR_REVISION", "MAJOR_REVISION", "REJECT"]), submit: z.boolean().default(false) });

export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "REVIEWER") return NextResponse.json({ error: "Reviewer access required." }, { status: 403 });
  const { assignmentId } = await params;
  const parsed = assignmentAction.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid assignment response." }, { status: 400 });
  const assignment = await prisma.reviewerAssignment.findFirst({ where: { id: assignmentId, reviewerId: actor.id, supersededAt: null, submission: { status: "UNDER_REVIEW" } }, include: { submission: { select: { researcherId: true } } } });
  if (!assignment || assignment.status !== "PENDING") return NextResponse.json({ error: "Assignment is no longer available." }, { status: 404 });
  const nextStatus = parsed.data.action === "ACCEPT" ? "ACCEPTED" : "CONFLICT_DECLARED";
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.reviewerAssignment.findFirst({ where: { id: assignmentId, reviewerId: actor.id, status: "PENDING", supersededAt: null, submission: { status: "UNDER_REVIEW" } }, select: { id: true } });
    if (!current) throw new Error("ASSIGNMENT_CLOSED");
    const updated = await tx.reviewerAssignment.update({ where: { id: assignmentId }, data: { status: nextStatus, acceptedAt: nextStatus === "ACCEPTED" ? new Date() : null, conflictNote: parsed.data.action === "CONFLICT" ? parsed.data.conflictNote : null } });
    await tx.workflowEvent.create({ data: { submissionId: assignment.submissionId, actorId: actor.id, eventType: nextStatus === "ACCEPTED" ? "REVIEW_ACCEPTED" : "REVIEW_CONFLICT_DECLARED", detail: nextStatus === "CONFLICT_DECLARED" ? { assignmentId, note: parsed.data.action === "CONFLICT" ? parsed.data.conflictNote : "" } : { assignmentId } } });
    if (nextStatus === "CONFLICT_DECLARED") await tx.notification.create({ data: { userId: assignment.assignedById, type: "ACTION_REQUIRED", title: "Reviewer declared a conflict", body: "A reviewer has declared a conflict and the assignment requires coordinator attention.", link: "/coordinator" } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: nextStatus, resourceType: "ReviewerAssignment", resourceId: assignmentId } });
    return updated;
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "ASSIGNMENT_CLOSED") return null;
    throw error;
  });
  if (!result) return NextResponse.json({ error: "This assignment or review round has closed." }, { status: 409 });
  if (nextStatus === "CONFLICT_DECLARED") await sendUserNotification(assignment.assignedById, "Reviewer declared a conflict", "A reviewer has declared a conflict and the assignment requires coordinator attention.", "/coordinator");
  return NextResponse.json(result);
}

export async function PUT(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "REVIEWER") return NextResponse.json({ error: "Reviewer access required." }, { status: 403 });
  const { assignmentId } = await params;
  const parsed = reviewInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Complete all scored criteria and provide useful author feedback.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const assignment = await prisma.reviewerAssignment.findFirst({ where: { id: assignmentId, reviewerId: actor.id, supersededAt: null, status: "ACCEPTED", submission: { status: "UNDER_REVIEW" } } });
  if (!assignment) return NextResponse.json({ error: "Only an accepted active assignment can be reviewed." }, { status: 403 });
  const review = await prisma.$transaction(async (tx) => {
    const currentAssignment = await tx.reviewerAssignment.findFirst({ where: { id: assignmentId, reviewerId: actor.id, supersededAt: null, status: "ACCEPTED", submission: { status: "UNDER_REVIEW" } }, select: { id: true } });
    if (!currentAssignment) throw new Error("ASSIGNMENT_CLOSED");
    const result = await tx.peerReview.upsert({ where: { assignmentId }, create: { assignmentId, originality: parsed.data.originality, relevance: parsed.data.relevance, researchQuality: parsed.data.researchQuality, methodology: parsed.data.methodology, clarity: parsed.data.clarity, authorComments: parsed.data.authorComments, confidentialComments: parsed.data.confidentialComments, recommendation: parsed.data.recommendation, submittedAt: parsed.data.submit ? new Date() : null }, update: { originality: parsed.data.originality, relevance: parsed.data.relevance, researchQuality: parsed.data.researchQuality, methodology: parsed.data.methodology, clarity: parsed.data.clarity, authorComments: parsed.data.authorComments, confidentialComments: parsed.data.confidentialComments, recommendation: parsed.data.recommendation, submittedAt: parsed.data.submit ? new Date() : null } });
    if (parsed.data.submit) {
      await tx.reviewerAssignment.update({ where: { id: assignmentId }, data: { status: "COMPLETED" } });
      await tx.notification.create({ data: { userId: assignment.assignedById, type: "INFO", title: "Review completed", body: "An assigned peer review has been submitted.", link: "/coordinator" } });
      await tx.workflowEvent.create({ data: { submissionId: assignment.submissionId, actorId: actor.id, eventType: "REVIEW_SUBMITTED", detail: { assignmentId } } });
    } else {
      await tx.workflowEvent.create({ data: { submissionId: assignment.submissionId, actorId: actor.id, eventType: "REVIEW_DRAFT_SAVED", detail: { assignmentId } } });
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: parsed.data.submit ? "REVIEW_SUBMITTED" : "REVIEW_DRAFT_SAVED", resourceType: "ReviewerAssignment", resourceId: assignmentId } });
    return result;
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "ASSIGNMENT_CLOSED") return null;
    throw error;
  });
  if (!review) return NextResponse.json({ error: "This assignment or review round has closed." }, { status: 409 });
  if (parsed.data.submit) await sendUserNotification(assignment.assignedById, "Review completed", "A peer review has been submitted and is ready for coordinator consideration.", "/coordinator");
  return NextResponse.json({ id: review.id, submittedAt: review.submittedAt });
}
