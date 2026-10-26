import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { sendUserNotification } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("EXTEND_DEADLINE"),
    dueAt: z.coerce.date(),
    reason: z.string().trim().min(10).max(1000),
  }),
  z.object({ action: z.literal("SEND_REMINDER") }),
]);
type Context = { params: Promise<{ assignmentId: string }> };

export async function PATCH(request: Request, { params }: Context) {
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
      { error: "Choose a valid review action and provide a reason when required." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const { assignmentId } = await params;
  const assignment = await prisma.reviewerAssignment.findFirst({
    where: {
      id: assignmentId,
      supersededAt: null,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
    select: {
      id: true,
      dueAt: true,
      reviewerId: true,
      reviewer: { select: { name: true } },
      submission: {
        select: {
          id: true,
          referenceNumber: true,
          title: true,
          call: { select: { title: true, coordinatorId: true } },
        },
      },
    },
  });
  if (!assignment) {
    return NextResponse.json(
      { error: "This review assignment is no longer active." },
      { status: 409 },
    );
  }

  if (data.action === "EXTEND_DEADLINE") {
    if (data.dueAt <= assignment.dueAt) {
      return NextResponse.json(
        { error: "The new deadline must be later than the current deadline." },
        { status: 400 },
      );
    }
    if (data.dueAt <= new Date()) {
      return NextResponse.json(
        { error: "The new deadline must be in the future." },
        { status: 400 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.reviewerAssignment.updateMany({
        where: {
          id: assignment.id,
          supersededAt: null,
          dueAt: assignment.dueAt,
          status: { in: ["PENDING", "ACCEPTED"] },
        },
        data: { dueAt: data.dueAt },
      });
      if (changed.count !== 1) return false;
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ADMIN_REVIEW_DEADLINE_EXTENDED",
          resourceType: "ReviewerAssignment",
          resourceId: assignment.id,
          detail: {
            submissionId: assignment.submission.id,
            reviewerId: assignment.reviewerId,
            from: assignment.dueAt.toISOString(),
            to: data.dueAt.toISOString(),
            reason: data.reason,
          },
        },
      });
      await tx.notification.create({
        data: {
          userId: assignment.reviewerId,
          type: "ACTION_REQUIRED",
          title: "Review deadline extended",
          body: `An administrator extended your deadline for ${assignment.submission.referenceNumber} to ${data.dueAt.toLocaleDateString()}. Reason: ${data.reason}`,
          link: "/reviewer",
        },
      });
      return true;
    });
    if (!updated) {
      return NextResponse.json(
        { error: "The assignment changed while this action was being processed. Refresh and try again." },
        { status: 409 },
      );
    }
    await sendUserNotification(
      assignment.reviewerId,
      "Review deadline extended",
      `Your deadline for ${assignment.submission.referenceNumber} has been extended to ${data.dueAt.toLocaleDateString()}. Reason: ${data.reason}`,
      "/reviewer",
    );
    return NextResponse.json({ updated: true });
  }

  const overdue = assignment.dueAt < new Date();
  await prisma.$transaction(async (tx) => {
    await tx.notification.create({
      data: {
        userId: assignment.reviewerId,
        type: "ACTION_REQUIRED",
        title: overdue ? "Overdue review reminder" : "Review deadline reminder",
        body: `This is a reminder for ${assignment.submission.referenceNumber}, due ${assignment.dueAt.toLocaleDateString()}.${overdue ? " The review is now overdue." : ""} Contact the research office if you need an extension.`,
        link: "/reviewer",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_REVIEW_REMINDER_SENT",
        resourceType: "ReviewerAssignment",
        resourceId: assignment.id,
        detail: {
          submissionId: assignment.submission.id,
          reviewerId: assignment.reviewerId,
          dueAt: assignment.dueAt.toISOString(),
          overdue,
        },
      },
    });
  });
  await sendUserNotification(
    assignment.reviewerId,
    overdue ? "Overdue review reminder" : "Review deadline reminder",
    `This is a reminder for ${assignment.submission.referenceNumber}, due ${assignment.dueAt.toLocaleDateString()}.${overdue ? " The review is now overdue." : ""}`,
    "/reviewer",
  );
  return NextResponse.json({ updated: true });
}
