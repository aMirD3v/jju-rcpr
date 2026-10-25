import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTransition } from "@/lib/domain/workflow";
import { sendUserNotification } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";

const input = z.object({ title: z.string().trim().min(8).max(400), abstract: z.string().trim().min(80).max(16000), requiredDocumentIds: z.array(z.string().cuid()).max(30).default([]) });
export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "RESEARCHER") return NextResponse.json({ error: "Researcher sign in is required." }, { status: 401 });
  const { submissionId } = await params;
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Provide a valid revised title and abstract." }, { status: 400 });
  const submission = await prisma.researchSubmission.findFirst({ where: { id: submissionId, researcherId: actor.id }, include: { call: { select: { requiredDocuments: { select: { id: true } } } } } });
  if (!submission || !["REVISION_REQUESTED", "RETURNED_FOR_CORRECTION"].includes(submission.status)) return NextResponse.json({ error: "This submission is not awaiting a revision." }, { status: 409 });
  if (new Set(parsed.data.requiredDocumentIds).size !== submission.call.requiredDocuments.length || submission.call.requiredDocuments.some((item) => !parsed.data.requiredDocumentIds.includes(item.id))) return NextResponse.json({ error: "Include every required document listed for this call." }, { status: 400 });
  assertTransition(submission.status, "SUBMITTED", "RESEARCHER");
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.researchSubmission.updateMany({ where: { id: submissionId, researcherId: actor.id, status: submission.status, currentRound: submission.currentRound }, data: { title: parsed.data.title, abstract: parsed.data.abstract, status: "SUBMITTED" } });
    if (changed.count !== 1) throw new Error("REVISION_ALREADY_SUBMITTED");
    await tx.submissionVersion.create({ data: { submissionId, round: submission.currentRound, title: parsed.data.title, abstract: parsed.data.abstract } });
    await tx.reviewerAssignment.updateMany({ where: { submissionId, supersededAt: null }, data: { supersededAt: new Date() } });
    await tx.workflowEvent.create({ data: { submissionId, actorId: actor.id, eventType: "REVISION_SUBMITTED", fromStatus: submission.status, toStatus: "SUBMITTED", detail: { round: submission.currentRound } } });
    await tx.notification.create({ data: { userId: (await tx.researchCall.findUniqueOrThrow({ where: { id: submission.callId }, select: { coordinatorId: true } })).coordinatorId, type: "ACTION_REQUIRED", title: "Revised submission received", body: `${submission.referenceNumber} has submitted a revised version.`, link: "/coordinator" } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "REVISION_SUBMITTED", resourceType: "ResearchSubmission", resourceId: submissionId, detail: { round: submission.currentRound } } });
    return tx.researchSubmission.findUniqueOrThrow({ where: { id: submissionId } });
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "REVISION_ALREADY_SUBMITTED") return null;
    throw error;
  });
  if (!result) return NextResponse.json({ error: "A revision has already been submitted for this round." }, { status: 409 });
  const call = await prisma.researchCall.findUnique({ where: { id: submission.callId }, select: { coordinatorId: true } });
  if (call) await sendUserNotification(call.coordinatorId, "Revised submission received", submission.referenceNumber + " has submitted a revised version.", "/coordinator");
  return NextResponse.json({ id: result.id, status: result.status, currentRound: result.currentRound });
}
