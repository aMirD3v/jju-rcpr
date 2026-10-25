import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const actor = await getActor();
  if (!actor || actor.role !== "REVIEWER") return NextResponse.json({ error: "Reviewer access required." }, { status: 403 });
  const assignments = await prisma.reviewerAssignment.findMany({ where: { reviewerId: actor.id, supersededAt: null, status: { in: ["PENDING", "ACCEPTED", "COMPLETED", "DECLINED", "CONFLICT_DECLARED"] } }, select: { id: true, dueAt: true, status: true, acceptedAt: true, createdAt: true, submission: { select: { id: true, referenceNumber: true, title: true, abstract: true, topic: true, currentRound: true, call: { select: { title: true, criteria: { orderBy: { position: "asc" } } } }, versions: { orderBy: { round: "desc" }, take: 1, include: { documents: { select: { id: true, originalName: true, mimeType: true, byteSize: true } } } } } }, review: true }, orderBy: { dueAt: "asc" } });
  const blindAssignments = assignments.map((assignment) => ({ ...assignment, submission: { ...assignment.submission, versions: assignment.submission.versions.map((version) => ({ ...version, documents: version.documents.map((document) => { const extension = document.originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "file"; return { ...document, originalName: `Review document ${document.id.slice(-6)}.${extension}` }; }) })) } }));
  return NextResponse.json(blindAssignments, { headers: { "Cache-Control": "no-store" } });
}
