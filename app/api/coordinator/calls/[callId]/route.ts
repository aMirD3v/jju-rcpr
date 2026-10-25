import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const updateSchema = z.object({ status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]).optional(), title: z.string().trim().min(8).max(240).optional(), description: z.string().trim().min(20).max(12000).optional(), topics: z.array(z.string().trim().min(2).max(120)).min(1).max(40).optional(), requirements: z.string().trim().min(10).max(12000).optional(), acceptedFileTypes: z.array(z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"])).min(1).optional(), opensAt: z.coerce.date().optional(), closesAt: z.coerce.date().optional(), criteria: z.array(z.object({ label: z.string().trim().min(2).max(180), description: z.string().max(1000).optional() })).max(20).optional() }).strict();
export async function PATCH(request: Request, { params }: RouteContext<"/api/coordinator/calls/[callId]">) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { callId } = await params;
  const current = await prisma.researchCall.findFirst({ where: { id: callId, coordinatorId: actor.id } });
  if (!current) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid call update." }, { status: 400 });
  const data = { ...parsed.data };
  const opensAt = data.opensAt ?? current.opensAt;
  const closesAt = data.closesAt ?? current.closesAt;
  if (closesAt <= opensAt) return NextResponse.json({ error: "The closing date must be after the opening date." }, { status: 400 });
  if (data.status === "OPEN" && (opensAt > new Date() || closesAt < new Date())) return NextResponse.json({ error: "An open call must be within its submission window." }, { status: 400 });
  const { criteria, ...callData } = data;
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.researchCall.update({ where: { id: callId }, data: callData });
    if (criteria) {
      await tx.reviewCriterion.deleteMany({ where: { callId } });
      await tx.reviewCriterion.createMany({ data: criteria.map((criterion, position) => ({ callId, position, ...criterion })) });
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "CALL_UPDATED", resourceType: "ResearchCall", resourceId: callId, detail: { changes: Object.keys(data) } } });
    return result;
  });
  return NextResponse.json(updated);
}
