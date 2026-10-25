import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOrigin } from "@/lib/security";

const callInput = z.object({ title: z.string().trim().min(8).max(240), description: z.string().trim().min(20).max(12000), topics: z.array(z.string().trim().min(2).max(120)).min(1).max(40), requirements: z.string().trim().min(10).max(12000), requiredDocuments: z.array(z.string().trim().min(2).max(160)).max(5).default([]), acceptedFileTypes: z.array(z.enum(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"])).min(1), opensAt: z.coerce.date(), closesAt: z.coerce.date(), status: z.enum(["DRAFT", "OPEN"]).default("DRAFT"), criteria: z.array(z.object({ label: z.string().trim().min(2).max(180), description: z.string().max(1000).optional() })).max(20).default([]) });

export async function GET() {
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const calls = await prisma.researchCall.findMany({ where: { coordinatorId: actor.id }, include: { _count: { select: { submissions: true } } }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(calls, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const parsed = callInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Call details are incomplete or invalid.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const data = parsed.data;
  if (new Set(data.requiredDocuments.map((label) => label.toLocaleLowerCase())).size !== data.requiredDocuments.length) return NextResponse.json({ error: "Required document names must be unique." }, { status: 400 });
  if (data.closesAt <= data.opensAt) return NextResponse.json({ error: "The closing date must be after the opening date." }, { status: 400 });
  if (data.status === "OPEN" && data.closesAt < new Date()) return NextResponse.json({ error: "A call cannot be published after its submission deadline." }, { status: 400 });
  const call = await prisma.$transaction(async (tx) => {
    const created = await tx.researchCall.create({ data: { title: data.title, description: data.description, topics: data.topics, requirements: data.requirements, acceptedFileTypes: data.acceptedFileTypes, opensAt: data.opensAt, closesAt: data.closesAt, status: data.status, coordinatorId: actor.id, criteria: { create: data.criteria.map((c, position) => ({ ...c, position })) }, requiredDocuments: { create: data.requiredDocuments.map((label, position) => ({ label, position })) } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "CALL_CREATED", resourceType: "ResearchCall", resourceId: created.id, detail: { status: created.status } } });
    return created;
  });
  return NextResponse.json(call, { status: 201 });
}
