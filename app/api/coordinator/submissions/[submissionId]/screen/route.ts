import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertTransition } from "@/lib/domain/workflow";
import { sendUserNotification } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";

const input = z.object({ outcome: z.enum(["ELIGIBLE_FOR_REVIEW", "RETURNED_FOR_CORRECTION", "SCREENING_DECLINED"]), note: z.string().trim().min(10).max(4000) });
export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Coordinator access required." }, { status: 403 });
  const { submissionId } = await params;
  const body = input.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Choose a screening outcome and provide a note." }, { status: 400 });
  const submission = await prisma.researchSubmission.findFirst({ where: { id: submissionId, call: { coordinatorId: actor.id } } });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  try { assertTransition(submission.status, body.data.outcome, "COORDINATOR"); } catch { return NextResponse.json({ error: "This screening outcome is not valid from the current status." }, { status: 409 }); }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.researchSubmission.updateMany({ where: { id: submission.id, status: submission.status }, data: { status: body.data.outcome, ...(body.data.outcome === "RETURNED_FOR_CORRECTION" ? { currentRound: { increment: 1 } } : {}) } });
    if (changed.count !== 1) throw new Error("SCREENING_ALREADY_RECORDED");
    const item = await tx.researchSubmission.findUniqueOrThrow({ where: { id: submission.id } });
    await tx.workflowEvent.create({ data: { submissionId: item.id, actorId: actor.id, eventType: "SCREENING_DECISION", fromStatus: submission.status, toStatus: item.status, detail: { note: body.data.note } } });
    await tx.notification.create({ data: { userId: item.researcherId, type: body.data.outcome === "ELIGIBLE_FOR_REVIEW" ? "INFO" : "ACTION_REQUIRED", title: "Screening update", body: body.data.note, link: "/portal" } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SUBMISSION_SCREENED", resourceType: "ResearchSubmission", resourceId: item.id, detail: { from: submission.status, to: item.status } } });
    return item;
  }, { isolationLevel: "Serializable" }).catch((error: unknown) => {
    if (error instanceof Error && error.message === "SCREENING_ALREADY_RECORDED") return null;
    throw error;
  });
  if (!updated) return NextResponse.json({ error: "A screening outcome was already recorded. Refresh and review the current status." }, { status: 409 });
  await sendUserNotification(updated.researcherId, "Screening update", body.data.note, "/portal");
  return NextResponse.json(updated);
}
