import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PageIntro } from "@/components/site/page-intro";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RevisionForm } from "@/components/forms/revision-form";
import { DocumentUpload } from "@/components/forms/document-upload";

export default async function ResearchSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role === "ADMIN") redirect("/admin");
  if (actor.role !== "RESEARCHER") redirect(actor.role === "COORDINATOR" ? "/coordinator" : "/reviewer");
  const { submissionId } = await params;
  const submission = await prisma.researchSubmission.findFirst({ where: { id: submissionId, researcherId: actor.id }, include: { call: { select: { title: true, acceptedFileTypes: true, requiredDocuments: { orderBy: { position: "asc" } } } }, authors: { orderBy: { position: "asc" } }, versions: { orderBy: { round: "desc" }, include: { documents: true } }, assignments: { where: { supersededAt: null }, select: { status: true, dueAt: true } }, decisions: { orderBy: { createdAt: "desc" } }, events: { orderBy: { createdAt: "asc" }, select: { eventType: true, fromStatus: true, toStatus: true, createdAt: true, detail: true } } } });
  if (!submission) notFound();
  const canRevise = submission.status === "REVISION_REQUESTED" || submission.status === "RETURNED_FOR_CORRECTION";
  const accept = submission.call.acceptedFileTypes.map((type) => type === "application/pdf" ? ".pdf" : type === "application/msword" ? ".doc" : ".docx").join(",");
  const currentVersion = submission.versions.find((version) => version.round === submission.currentRound);
  const uploadedRequirementIds = new Set(currentVersion?.documents.map((document) => document.requirementId).filter((id): id is string => Boolean(id)) ?? []);
  const missingRequirements = submission.call.requiredDocuments.filter((item) => !uploadedRequirementIds.has(item.id));
  const latestScreening = [...submission.events].reverse().find((event) => event.eventType === "SCREENING_DECISION");
  const screeningNote = latestScreening?.detail && typeof latestScreening.detail === "object" && "note" in latestScreening.detail && typeof latestScreening.detail.note === "string" ? latestScreening.detail.note : "";
  return <main className="workspace-page"><Link href="/portal" className="text-link">← My submissions</Link><div className="submission-detail-top"><PageIntro eyebrow={submission.referenceNumber + " · " + submission.call.title} title={submission.title}>{submission.topic} · Round {submission.currentRound}</PageIntro><Badge tone={submission.status === "ACCEPTED" ? "green" : canRevise ? "amber" : "blue"}>{submission.status.replaceAll("_", " ")}</Badge></div><div className="detail-grid"><div className="detail-column"><Card><p className="eyebrow">Abstract</p><p>{submission.abstract}</p><p><strong>Institution:</strong> {submission.institution}</p><h3>Authors</h3><ul>{submission.authors.map((author) => <li key={author.id}>{author.fullName} · {author.institution}{author.isCorresponding ? " · Corresponding author" : ""}</li>)}</ul></Card><Card><p className="eyebrow">Version history</p>{submission.versions.map((version) => <div className="version-row" key={version.id}><strong>Round {version.round}</strong><span>Submitted {version.submittedAt.toLocaleDateString()}</span>{version.documents.map((document) => <a className="text-link" key={document.id} href={"/api/documents/" + document.id}>{document.originalName} · {(document.byteSize / 1024 / 1024).toFixed(1)} MB ↗</a>)}</div>)}{submission.status === "SUBMITTED" && <DocumentUpload submissionId={submission.id} requirements={missingRequirements} accept={accept} />}</Card>{canRevise && <Card><p className="eyebrow">Revision requested</p><h2>Submit an updated version</h2><RevisionForm submissionId={submission.id} round={submission.currentRound} requirements={submission.call.requiredDocuments} accept={accept} /></Card>}</div><div className="detail-column">{screeningNote && <Card><p className="eyebrow">Screening feedback</p><p>{screeningNote}</p></Card>}<Card><p className="eyebrow">Decision history</p>{submission.decisions.map((decision) => <div className="decision-feedback" key={decision.id}><strong>{decision.status.replaceAll("_", " ")}</strong><span>{decision.createdAt.toLocaleDateString()}</span><p>{decision.feedback}</p></div>)}{submission.decisions.length === 0 && <p>No coordinator decision has been recorded yet.</p>}</Card><Card><p className="eyebrow">Workflow timeline</p><ol className="timeline">{submission.events.map((event, index) => <li key={index}><span>{event.eventType.replaceAll("_", " ")}</span><time>{event.createdAt.toLocaleDateString()}</time></li>)}</ol></Card><Card><p className="eyebrow">Review progress</p>{submission.assignments.map((assignment, index) => <p key={index}>Review {index + 1}: {assignment.status.replaceAll("_", " ")}{assignment.status !== "COMPLETED" ? " · due " + assignment.dueAt.toLocaleDateString() : ""}</p>)}</Card></div></div></main>;
}
