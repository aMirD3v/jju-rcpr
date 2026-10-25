import { NextResponse } from "next/server";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const actor = await getActor();
  if (!actor) return NextResponse.json({ error: "Sign in to view this submission." }, { status: 401 });
  const { submissionId } = await params;
  const submission = await prisma.researchSubmission.findFirst({
    where: { id: submissionId, ...(actor.role === "COORDINATOR" ? { call: { coordinatorId: actor.id } } : {}) },
    include: {
      call: { select: { title: true, criteria: { orderBy: { position: "asc" } } } },
      authors: { orderBy: { position: "asc" } },
      versions: { orderBy: { round: "desc" }, include: { documents: true } },
      documents: true,
      assignments: { where: { supersededAt: null, ...(actor.role === "REVIEWER" ? { reviewerId: actor.id } : {}) }, include: { reviewer: { select: { id: true, name: true } }, review: true }, orderBy: { createdAt: "asc" } },
      decisions: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } },
    },
  });
  if (!submission) return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  const owner = actor.role === "RESEARCHER" && submission.researcherId === actor.id;
  const coordinator = actor.role === "COORDINATOR";
  const reviewer = actor.role === "REVIEWER" && submission.assignments.some((assignment) => assignment.reviewerId === actor.id && ["PENDING", "ACCEPTED", "COMPLETED"].includes(assignment.status));
  if (!owner && !coordinator && !reviewer) return NextResponse.json({ error: "You are not authorized to view this submission." }, { status: 403 });
  if (owner) {
    const { assignments, ...ownerSubmission } = submission;
    return NextResponse.json({ ...ownerSubmission, assignments: assignments.map((a) => ({ id: a.id, status: a.status, dueAt: a.dueAt })), decisions: submission.decisions.map(({ id, status, feedback, createdAt }) => ({ id, status, feedback, createdAt })), events: submission.events.map(({ eventType, fromStatus, toStatus, createdAt }) => ({ eventType, fromStatus, toStatus, createdAt })), documents: submission.documents });
  }
  if (reviewer && !coordinator) {
    const { authors, institution, researcherId, ...blindSubmission } = submission;
    void authors; void institution; void researcherId;
    const anonymizeDocument = <T extends { id: string; originalName: string }>(document: T) => {
      const extension = document.originalName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "file";
      return { ...document, originalName: `Review document ${document.id.slice(-6)}.${extension}` };
    };
    return NextResponse.json({ ...blindSubmission, versions: submission.versions.map((version) => ({ ...version, documents: version.documents.map(anonymizeDocument) })), documents: submission.documents.map(anonymizeDocument), assignments: submission.assignments.filter((a) => a.reviewerId === actor.id).map((a) => ({ ...a, reviewer: { id: a.reviewer.id } })), decisions: [], events: submission.events.map(({ eventType, fromStatus, toStatus, createdAt }) => ({ eventType, fromStatus, toStatus, createdAt })) });
  }
  return NextResponse.json(submission);
}
