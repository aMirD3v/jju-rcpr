import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendUserNotification } from "@/lib/email";
import { isSameOrigin } from "@/lib/security";

const submissionInput = z.object({ callId: z.string().min(8), title: z.string().trim().min(8).max(400), abstract: z.string().trim().min(80).max(16000), topic: z.string().trim().min(2).max(120), institution: z.string().trim().min(2).max(180), requiredDocumentIds: z.array(z.string().min(8)).max(20).default([]), authors: z.array(z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), institution: z.string().trim().min(2).max(180), isCorresponding: z.boolean().default(false) })).min(1).max(20) });

export async function GET() {
  const actor = await getActor();
  if (!actor || actor.role !== "RESEARCHER") return NextResponse.json({ error: "Sign in as a researcher to view submissions." }, { status: 401 });
  const submissions = await prisma.researchSubmission.findMany({ where: { researcherId: actor.id }, select: { id: true, referenceNumber: true, title: true, topic: true, status: true, currentRound: true, createdAt: true, updatedAt: true, call: { select: { title: true } }, decisions: { select: { status: true, feedback: true, createdAt: true }, orderBy: { createdAt: "desc" } }, events: { select: { eventType: true, fromStatus: true, toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } } }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(submissions, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  const actor = await getActor();
  if (!actor || actor.role !== "RESEARCHER") return NextResponse.json({ error: "Sign in as a researcher before submitting." }, { status: 401 });
  const parsed = submissionInput.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Check all required submission details.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const data = parsed.data;
  const call = await prisma.researchCall.findFirst({ where: { id: data.callId, status: "OPEN", opensAt: { lte: new Date() }, closesAt: { gte: new Date() } }, select: { id: true, topics: true, requiredDocuments: { select: { id: true } } } });
  if (!call) return NextResponse.json({ error: "This call is not currently accepting submissions." }, { status: 409 });
  const requiredIds = call.requiredDocuments.map((item) => item.id).sort();
  if (JSON.stringify([...data.requiredDocumentIds].sort()) !== JSON.stringify(requiredIds)) return NextResponse.json({ error: "The required document checklist changed. Refresh the form and try again." }, { status: 400 });
  if (!call.topics.includes(data.topic)) return NextResponse.json({ error: "Select a topic listed in the call." }, { status: 400 });
  if (!data.authors.some((author) => author.email.toLowerCase() === actor.email?.toLowerCase())) return NextResponse.json({ error: "Add your account email as an author so the submission remains linked to your account." }, { status: 400 });
  const referenceNumber = `JJU-${new Date().getFullYear()}-${randomBytes(8).toString("hex").toUpperCase()}`;
  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.researchSubmission.create({ data: { referenceNumber, callId: call.id, researcherId: actor.id, title: data.title, abstract: data.abstract, topic: data.topic, institution: data.institution, authors: { create: data.authors.map((a, position) => ({ ...a, email: a.email.toLowerCase(), position })) }, versions: { create: { round: 1, title: data.title, abstract: data.abstract } } } });
    await tx.workflowEvent.create({ data: { submissionId: created.id, actorId: actor.id, eventType: "SUBMITTED", toStatus: "SUBMITTED", detail: { round: 1 } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SUBMISSION_CREATED", resourceType: "ResearchSubmission", resourceId: created.id } });
    await tx.notification.create({ data: { userId: actor.id, type: "INFO", title: "Submission received", body: `Your submission ${referenceNumber} has been received.`, link: "/portal" } });
    return created;
  });
  await sendUserNotification(actor.id, "Submission received", "Your submission " + submission.referenceNumber + " has been received and is awaiting coordinator screening.", "/portal");
  return NextResponse.json({ id: submission.id, referenceNumber: submission.referenceNumber, status: submission.status }, { status: 201 });
}
