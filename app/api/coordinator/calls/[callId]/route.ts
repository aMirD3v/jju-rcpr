import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const updateSchema = z.object({ status: z.enum(["DRAFT", "OPEN", "CLOSED", "ARCHIVED"]).optional(), title: z.string().trim().min(8).max(240).optional(), description: z.string().trim().min(20).max(12000).optional(), topics: z.array(z.string().trim().min(2).max(120)).min(1).max(40).optional(), requirements: z.string().trim().min(10).max(12000).optional(), requiredDocuments: z.array(z.string().trim().min(2).max(160)).max(5).optional(), acceptedFileTypes: z.array(z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"])).min(1).optional(), opensAt: z.coerce.date().optional(), closesAt: z.coerce.date().optional(), criteria: z.array(z.object({ label: z.string().trim().min(2).max(180), description: z.string().max(1000).optional() })).max(20).optional() }).strict();
export async function PATCH(request: Request, { params }: RouteContext<"/api/coordinator/calls/[callId]">) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { callId } = await params;
  const current = await prisma.researchCall.findFirst({ where: { id: callId, coordinatorId: actor.id }, include: { requiredDocuments: { orderBy: { position: "asc" } }, _count: { select: { submissions: true } } } });
  if (!current) return NextResponse.json({ error: "Call not found" }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid call update." }, { status: 400 });
  const data = { ...parsed.data };
  if (data.requiredDocuments && new Set(data.requiredDocuments.map((label) => label.toLocaleLowerCase())).size !== data.requiredDocuments.length) return NextResponse.json({ error: "Required document names must be unique." }, { status: 400 });
  if (data.requiredDocuments && current._count.submissions > 0 && (data.requiredDocuments.length !== current.requiredDocuments.length || data.requiredDocuments.some((label, index) => label.toLocaleLowerCase() !== current.requiredDocuments[index]?.label.toLocaleLowerCase()))) return NextResponse.json({ error: "The required document checklist is locked after the first submission so published requirements remain fair to all researchers." }, { status: 409 });
  const opensAt = data.opensAt ?? current.opensAt;
  const closesAt = data.closesAt ?? current.closesAt;
  if (closesAt <= opensAt) return NextResponse.json({ error: "The closing date must be after the opening date." }, { status: 400 });
  if (data.status === "OPEN" && closesAt < new Date()) return NextResponse.json({ error: "A call cannot be published after its submission deadline." }, { status: 400 });
  const { criteria, requiredDocuments, ...callData } = data;
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.researchCall.update({ where: { id: callId }, data: callData });
    if (criteria) {
      await tx.reviewCriterion.deleteMany({ where: { callId } });
      await tx.reviewCriterion.createMany({ data: criteria.map((criterion, position) => ({ callId, position, ...criterion })) });
    }
    if (requiredDocuments) {
      const existing = await tx.callDocumentRequirement.findMany({ where: { callId }, orderBy: { position: "asc" } });
      const keepIds: string[] = [];
      for (const [position, label] of requiredDocuments.entries()) {
        const match = existing.find((item) => item.label.toLocaleLowerCase() === label.toLocaleLowerCase());
        if (match) {
          keepIds.push(match.id);
          if (match.position !== position || match.label !== label) await tx.callDocumentRequirement.update({ where: { id: match.id }, data: { label, position } });
        } else {
          const createdRequirement = await tx.callDocumentRequirement.create({ data: { callId, label, position } });
          keepIds.push(createdRequirement.id);
        }
      }
      await tx.callDocumentRequirement.deleteMany({ where: { callId, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) } });
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: "CALL_UPDATED", resourceType: "ResearchCall", resourceId: callId, detail: { changes: Object.keys(data) } } });
    return result;
  });
  return NextResponse.json(updated);
}
