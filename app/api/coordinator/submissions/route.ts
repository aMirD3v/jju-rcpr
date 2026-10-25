import { NextResponse } from "next/server";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Coordinator access required." }, { status: 403 });
  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get("status");
  const status = rawStatus ? z.enum(["SUBMITTED", "RETURNED_FOR_CORRECTION", "SCREENING_DECLINED", "ELIGIBLE_FOR_REVIEW", "UNDER_REVIEW", "REVISION_REQUESTED", "ACCEPTED", "REJECTED"]).safeParse(rawStatus) : null;
  if (status && !status.success) return NextResponse.json({ error: "Unknown submission status." }, { status: 400 });
  const callId = searchParams.get("callId");
  const search = searchParams.get("q")?.trim().slice(0, 120);
  const submissions = await prisma.researchSubmission.findMany({ where: { call: { coordinatorId: actor.id }, ...(status?.success ? { status: status.data } : {}), ...(callId ? { callId } : {}), ...(search ? { OR: [{ title: { contains: search, mode: "insensitive" } }, { referenceNumber: { contains: search, mode: "insensitive" } }, { researcher: { name: { contains: search, mode: "insensitive" } } }, { researcher: { email: { contains: search, mode: "insensitive" } } }] } : {}) }, include: { call: { select: { title: true } }, researcher: { select: { name: true, email: true } }, _count: { select: { assignments: true } }, assignments: { where: { supersededAt: null }, select: { id: true, reviewerId: true, reviewer: { select: { name: true } }, status: true, dueAt: true, review: { select: { submittedAt: true } } } } }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(submissions, { headers: { "Cache-Control": "no-store" } });
}
