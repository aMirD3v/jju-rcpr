import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageIntro } from "@/components/site/page-intro";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function CoordinatorSubmissionPage({ params }: { params: Promise<{ submissionId: string }> }) {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role !== "COORDINATOR") redirect(actor.role === "ADMIN" ? "/admin" : actor.role === "REVIEWER" ? "/reviewer" : "/portal");
  const { submissionId } = await params;
  const submission = await prisma.researchSubmission.findFirst({
    where: { id: submissionId, call: { coordinatorId: actor.id } },
    include: {
      call: { select: { title: true, criteria: { orderBy: { position: "asc" } } } },
      researcher: { select: { name: true, email: true } },
      authors: { orderBy: { position: "asc" } },
      versions: { orderBy: { round: "desc" }, include: { documents: true } },
      assignments: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { name: true, email: true } }, review: true } },
      decisions: { orderBy: { createdAt: "desc" }, include: { decisionMaker: { select: { name: true } } } },
      events: { orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } },
    },
  });
  if (!submission) notFound();
  const audit = await prisma.auditLog.findMany({ where: { resourceType: "ResearchSubmission", resourceId: submission.id }, orderBy: { createdAt: "asc" }, include: { actor: { select: { name: true, role: true } } } });
  return <main className="workspace-page">
    <Link href="/coordinator/screening" className="text-link">← Coordinator overview</Link>
    <div className="submission-detail-top"><PageIntro eyebrow={`${submission.referenceNumber} · ${submission.call.title}`} title={submission.title}>{submission.topic} · Round {submission.currentRound}</PageIntro><Badge tone={submission.status === "ACCEPTED" ? "green" : submission.status.includes("REVISION") ? "amber" : "blue"}>{submission.status.replaceAll("_", " ")}</Badge></div>
    <div className="detail-grid"><div className="detail-column">
      <Card><p className="eyebrow">Researcher and authors</p><p><strong>Account:</strong> {submission.researcher.name} · <a className="text-link" href={`mailto:${submission.researcher.email}`}>{submission.researcher.email}</a></p><p><strong>Institution:</strong> {submission.institution}</p><ul>{submission.authors.map((author) => <li key={author.id}>{author.fullName} · {author.email} · {author.institution}{author.isCorresponding ? " · Corresponding author" : ""}</li>)}</ul><h3>Abstract</h3><p>{submission.abstract}</p></Card>
      <Card><p className="eyebrow">Submission versions and documents</p>{submission.versions.map((version) => <div className="version-row" key={version.id}><strong>Round {version.round}</strong><span>{version.submittedAt.toLocaleString()}</span><p>{version.title}</p>{version.documents.map((document) => <a className="text-link" key={document.id} href={`/api/documents/${document.id}`}>{document.originalName} · {(document.byteSize / 1024 / 1024).toFixed(1)} MB ↗</a>)}</div>)}</Card>
      <Card><p className="eyebrow">Review reports</p>{submission.assignments.map((assignment) => <section className="review-report" key={assignment.id}><h3>{assignment.reviewer.name} · {assignment.status.replaceAll("_", " ")}</h3><p>{assignment.reviewer.email} · due {assignment.dueAt.toLocaleDateString()}</p>{assignment.conflictNote && <p><strong>Conflict note:</strong> {assignment.conflictNote}</p>}{assignment.review ? <><div className="score-grid">{[["Originality", assignment.review.originality], ["Relevance", assignment.review.relevance], ["Research quality", assignment.review.researchQuality], ["Methodology", assignment.review.methodology], ["Clarity", assignment.review.clarity]].map(([label, score]) => <p key={String(label)}><strong>{label}</strong><br />{score}/5</p>)}</div><p><strong>Recommendation:</strong> {assignment.review.recommendation.replaceAll("_", " ")}{assignment.review.submittedAt ? ` · submitted ${assignment.review.submittedAt.toLocaleString()}` : " · draft"}</p><h4>Comments for the author</h4><p>{assignment.review.authorComments}</p>{assignment.review.confidentialComments && <><h4>Confidential coordinator comments</h4><p>{assignment.review.confidentialComments}</p></>}</> : <p>No review has been submitted.</p>}</section>)}{submission.assignments.length === 0 && <p>No reviewers have been assigned.</p>}</Card>
    </div><div className="detail-column">
      <Card><p className="eyebrow">Coordinator decisions</p>{submission.decisions.map((decision) => <div className="decision-feedback" key={decision.id}><strong>{decision.status.replaceAll("_", " ")}</strong><span>{decision.createdAt.toLocaleString()} · {decision.decisionMaker.name}</span><p>{decision.feedback}</p>{decision.isOverride && <p><strong>Review override:</strong> {decision.overrideReason}</p>}</div>)}{submission.decisions.length === 0 && <p>No decision recorded.</p>}</Card>
      <Card><p className="eyebrow">Workflow history</p><ol className="timeline">{submission.events.map((event) => <li key={event.id}><span>{event.eventType.replaceAll("_", " ")} · {event.actor.name} ({event.actor.role.toLowerCase()})</span><time>{event.createdAt.toLocaleString()}</time>{event.detail && <small>{JSON.stringify(event.detail)}</small>}</li>)}</ol></Card>
      <Card><p className="eyebrow">Audit trail</p><ol className="timeline">{audit.map((entry) => <li key={entry.id}><span>{entry.action} · {entry.actor?.name ?? "System"}</span><time>{entry.createdAt.toLocaleString()}</time>{entry.detail && <small>{JSON.stringify(entry.detail)}</small>}</li>)}</ol>{audit.length === 0 && <p>No audit actions recorded.</p>}</Card>
    </div></div>
  </main>;
}
