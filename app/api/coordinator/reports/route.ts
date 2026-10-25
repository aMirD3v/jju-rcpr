import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function csv(value: unknown) {
  let text = value instanceof Date ? value.toISOString() : value == null ? "" : String(value);
  if (/^[=+@\-\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export async function GET(request: Request) {
  const actor = await getActor();
  if (!actor || actor.role !== "COORDINATOR") return NextResponse.json({ error: "Coordinator access required." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const callId = params.get("callId") || undefined;
  const fromRaw = params.get("from"); const toRaw = params.get("to");
  const from = fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : undefined;
  const to = toRaw ? new Date(`${toRaw}T23:59:59.999Z`) : undefined;
  if (!["submissions", "reviews"].includes(kind ?? "") || (from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) return NextResponse.json({ error: "Choose a report and valid date range." }, { status: 400 });
  if (callId && !await prisma.researchCall.findFirst({ where: { id: callId, coordinatorId: actor.id }, select: { id: true } })) return NextResponse.json({ error: "Call not found." }, { status: 404 });
  const where = { call: { coordinatorId: actor.id, ...(callId ? { id: callId } : {}) }, ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
  let lines: string[];
  if (kind === "submissions") {
    const rows = await prisma.researchSubmission.findMany({ where, include: { call: { select: { title: true } }, assignments: { where: { supersededAt: null }, select: { status: true } }, decisions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, createdAt: true } } }, orderBy: { createdAt: "asc" }, take: 20000 });
    lines = [["reference", "call", "title", "topic", "status", "round", "active_reviews", "latest_decision", "submitted_at", "updated_at"], ...rows.map((row) => [row.referenceNumber, row.call.title, row.title, row.topic, row.status, row.currentRound, row.assignments.length, row.decisions[0]?.status, row.createdAt, row.updatedAt])].map((row) => row.map(csv).join(","));
  } else {
    const rows = await prisma.reviewerAssignment.findMany({ where: { submission: where, createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }, include: { reviewer: { select: { name: true } }, submission: { select: { referenceNumber: true, title: true, topic: true, call: { select: { title: true } } } }, review: { select: { originality: true, relevance: true, researchQuality: true, methodology: true, clarity: true, recommendation: true, submittedAt: true } } }, orderBy: { createdAt: "asc" }, take: 20000 });
    lines = [["reference", "call", "title", "topic", "reviewer", "assignment_status", "due_at", "submitted_at", "originality", "relevance", "research_quality", "methodology", "clarity", "recommendation"], ...rows.map((row) => [row.submission.referenceNumber, row.submission.call.title, row.submission.title, row.submission.topic, row.reviewer.name, row.status, row.dueAt, row.review?.submittedAt, row.review?.originality, row.review?.relevance, row.review?.researchQuality, row.review?.methodology, row.review?.clarity, row.review?.recommendation])].map((row) => row.map(csv).join(","));
  }
  return new Response(`\uFEFF${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="jju-rcpr-${kind}-report.csv"`, "Cache-Control": "no-store" } });
}
