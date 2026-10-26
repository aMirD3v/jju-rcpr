import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_STATUS"),
    status: z.enum(["OPEN", "CLOSED", "ARCHIVED"]),
    reason: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("EXTEND_DEADLINE"),
    closesAt: z.coerce.date(),
    reason: z.string().trim().min(10).max(1000),
  }),
  z.object({
    action: z.literal("REASSIGN"),
    coordinatorId: z.string().min(8),
    reason: z.string().trim().min(10).max(1000),
  }),
]);

const statusTransitions: Record<string, string[]> = {
  DRAFT: ["OPEN", "ARCHIVED"],
  OPEN: ["CLOSED", "ARCHIVED"],
  CLOSED: ["OPEN", "ARCHIVED"],
  ARCHIVED: ["CLOSED"],
};

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/admin/calls/[callId]">,
) {
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
      { error: "Choose a valid supervision action and provide a reason." },
      { status: 400 },
    );
  }
  const data = parsed.data;
  const { callId } = await params;
  const call = await prisma.researchCall.findUnique({
    where: { id: callId },
    select: {
      id: true,
      title: true,
      status: true,
      opensAt: true,
      closesAt: true,
      coordinatorId: true,
    },
  });
  if (!call) {
    return NextResponse.json({ error: "Research call not found." }, { status: 404 });
  }

  if (data.action === "SET_STATUS") {
    const nextStatus = data.status;
    if (nextStatus !== "OPEN" && (!data.reason || data.reason.length < 10)) {
      return NextResponse.json(
        { error: "Record a reason of at least 10 characters for this status change." },
        { status: 400 },
      );
    }
    if (!statusTransitions[call.status]?.includes(nextStatus)) {
      return NextResponse.json(
        { error: `A ${call.status.toLowerCase()} call cannot be changed to ${nextStatus.toLowerCase()}.` },
        { status: 409 },
      );
    }
    if (nextStatus === "OPEN" && call.closesAt < new Date()) {
      return NextResponse.json(
        { error: "Extend the deadline before reopening this call." },
        { status: 409 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.researchCall.updateMany({
        where: { id: callId, status: call.status as typeof call.status },
        data: { status: nextStatus },
      });
      if (changed.count !== 1) return false;
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ADMIN_CALL_STATUS_CHANGED",
          resourceType: "ResearchCall",
          resourceId: callId,
          detail: {
            from: call.status,
            to: nextStatus,
            reason: data.reason ?? null,
          },
        },
      });
      await tx.notification.create({
        data: {
          userId: call.coordinatorId,
          type: "INFO",
          title: "Research call status updated",
          body: `An administrator changed "${call.title}" from ${call.status.toLowerCase()} to ${nextStatus.toLowerCase()}.${data.reason ? ` Reason: ${data.reason}` : ""}`,
          link: "/coordinator/calls",
        },
      });
      return true;
    });
    return updated
      ? NextResponse.json({ updated: true })
      : NextResponse.json(
          { error: "The call changed while this action was being processed. Refresh and try again." },
          { status: 409 },
        );
  }

  if (data.action === "EXTEND_DEADLINE") {
    if (call.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Restore this call before changing its deadline." },
        { status: 409 },
      );
    }
    if (data.closesAt <= call.closesAt) {
      return NextResponse.json(
        { error: "The new deadline must be later than the current deadline." },
        { status: 400 },
      );
    }
    if (data.closesAt <= new Date()) {
      return NextResponse.json(
        { error: "The new deadline must be in the future." },
        { status: 400 },
      );
    }
    const updated = await prisma.$transaction(async (tx) => {
      const changed = await tx.researchCall.updateMany({
        where: { id: callId, closesAt: call.closesAt },
        data: { closesAt: data.closesAt },
      });
      if (changed.count !== 1) return false;
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "ADMIN_CALL_DEADLINE_EXTENDED",
          resourceType: "ResearchCall",
          resourceId: callId,
          detail: {
            from: call.closesAt.toISOString(),
            to: data.closesAt.toISOString(),
            reason: data.reason,
          },
        },
      });
      await tx.notification.create({
        data: {
          userId: call.coordinatorId,
          type: "INFO",
          title: "Research call deadline extended",
          body: `An administrator extended the deadline for "${call.title}" to ${data.closesAt.toLocaleDateString()}. Reason: ${data.reason}`,
          link: "/coordinator/calls",
        },
      });
      return true;
    });
    return updated
      ? NextResponse.json({ updated: true })
      : NextResponse.json(
          { error: "The call deadline changed while this action was being processed. Refresh and try again." },
          { status: 409 },
        );
  }

  if (data.coordinatorId === call.coordinatorId) {
    return NextResponse.json(
      { error: "This coordinator already owns the call." },
      { status: 409 },
    );
  }
  const coordinator = await prisma.user.findFirst({
    where: {
      id: data.coordinatorId,
      role: "COORDINATOR",
      isActive: true,
      emailVerifiedAt: { not: null },
    },
    select: { id: true, name: true },
  });
  if (!coordinator) {
    return NextResponse.json(
      { error: "Select an active, verified coordinator." },
      { status: 404 },
    );
  }
  const reassigned = await prisma.$transaction(async (tx) => {
    const changed = await tx.researchCall.updateMany({
      where: { id: callId, coordinatorId: call.coordinatorId },
      data: { coordinatorId: coordinator.id },
    });
    if (changed.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ADMIN_CALL_COORDINATOR_REASSIGNED",
        resourceType: "ResearchCall",
        resourceId: callId,
        detail: {
          from: call.coordinatorId,
          to: coordinator.id,
          reason: data.reason,
        },
      },
    });
    await tx.notification.createMany({
      data: [
        {
          userId: call.coordinatorId,
          type: "INFO",
          title: "Research call reassigned",
          body: `An administrator reassigned "${call.title}" to another coordinator. Reason: ${data.reason}`,
          link: "/coordinator/calls",
        },
        {
          userId: coordinator.id,
          type: "ACTION_REQUIRED",
          title: "Research call assigned to you",
          body: `An administrator assigned "${call.title}" to you. Reason: ${data.reason}`,
          link: "/coordinator/calls",
        },
      ],
    });
    return true;
  });
  return reassigned
    ? NextResponse.json({ updated: true })
    : NextResponse.json(
        { error: "The call owner changed while this action was being processed. Refresh and try again." },
        { status: 409 },
      );
}
