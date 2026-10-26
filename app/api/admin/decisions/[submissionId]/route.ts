import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { sendUserNotification } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const input = z.object({
  reason: z.string().trim().min(20).max(2000),
});
type Context = { params: Promise<{ submissionId: string }> };

export async function POST(request: Request, { params }: Context) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  }
  const actor = await getActor();
  if (!actor || actor.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Record a reason of at least 20 characters for reopening a decision." },
      { status: 400 },
    );
  }
  const { submissionId } = await params;
  const submission = await prisma.researchSubmission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      referenceNumber: true,
      title: true,
      status: true,
      researcherId: true,
      researcher: { select: { name: true } },
      call: { select: { title: true, coordinatorId: true } },
      decisions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, feedback: true, createdAt: true },
      },
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (!["ACCEPTED", "REJECTED"].includes(submission.status)) {
    return NextResponse.json(
      { error: "Only a final accepted or rejected submission can be reopened." },
      { status: 409 },
    );
  }
  const previousStatus = submission.status;
  const reopened = await prisma.$transaction(async (tx) => {
    const changed = await tx.researchSubmission.updateMany({
      where: {
        id: submission.id,
        status: { in: ["ACCEPTED", "REJECTED"] },
      },
      data: { status: "ELIGIBLE_FOR_REVIEW" },
    });
    if (changed.count !== 1) return false;
    await tx.reviewerAssignment.updateMany({
      where: { submissionId: submission.id, supersededAt: null },
      data: { supersededAt: new Date() },
    });
    await tx.workflowEvent.create({
      data: {
        submissionId: submission.id,
        actorId: actor.id,
        eventType: "ADMIN_DECISION_REOPENED",
        fromStatus: previousStatus,
        toStatus: "ELIGIBLE_FOR_REVIEW",
        detail: { reason: parsed.data.reason },
      },
    });
    await tx.notification.createMany({
      data: [
        {
          userId: submission.researcherId,
          type: "DECISION",
          title: "Decision reopened",
          body: `The research office reopened the decision for ${submission.referenceNumber}. Reason: ${parsed.data.reason}`,
          link: `/portal/submissions/${submission.id}`,
        },
        {
          userId: submission.call.coordinatorId,
          type: "ACTION_REQUIRED",
          title: "Submission reopened for review",
          body: `${submission.referenceNumber} has been reopened by an administrator and is eligible for a new review round. Reason: ${parsed.data.reason}`,
          link: `/coordinator/submissions/${submission.id}`,
        },
      ],
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_DECISION_REOPENED",
        resourceType: "ResearchSubmission",
        resourceId: submission.id,
        detail: {
          referenceNumber: submission.referenceNumber,
          from: previousStatus,
          to: "ELIGIBLE_FOR_REVIEW",
          decisionId: submission.decisions[0]?.id ?? null,
          reason: parsed.data.reason,
        },
      },
    });
    return true;
  });
  if (!reopened) {
    return NextResponse.json(
      { error: "The submission changed while this request was being processed. Refresh and try again." },
      { status: 409 },
    );
  }
  await sendUserNotification(
    submission.researcherId,
    "Decision reopened",
    `The research office reopened the decision for ${submission.referenceNumber}. Reason: ${parsed.data.reason}`,
    `/portal/submissions/${submission.id}`,
  );
  return NextResponse.json({ updated: true });
}
