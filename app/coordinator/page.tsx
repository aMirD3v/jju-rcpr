import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireCoordinator } from "@/lib/coordinator-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Coordinator overview" };
const tasks = [
  { href: "/coordinator/screening", label: "Awaiting screening", description: "New submissions needing assessment", key: "screening" },
  { href: "/coordinator/assignments", label: "Awaiting assignment", description: "Eligible work ready for reviewers", key: "assignment" },
  { href: "/coordinator/decisions", label: "Reviews to decide", description: "Completed review sets awaiting action", key: "decision" },
];

export default async function CoordinatorPage() {
  const actor = await requireCoordinator();
  const now = new Date();
  const [calls, openCalls, totalSubmissions, awaitingScreening, awaitingAssignment, inReview, overdue, candidates, latest] = await Promise.all([
    prisma.researchCall.count({ where: { coordinatorId: actor.id } }),
    prisma.researchCall.count({ where: { coordinatorId: actor.id, status: "OPEN", opensAt: { lte: now }, closesAt: { gte: now } } }),
    prisma.researchSubmission.count({ where: { call: { coordinatorId: actor.id } } }),
    prisma.researchSubmission.count({ where: { call: { coordinatorId: actor.id }, status: "SUBMITTED" } }),
    prisma.researchSubmission.count({ where: { call: { coordinatorId: actor.id }, status: "ELIGIBLE_FOR_REVIEW" } }),
    prisma.researchSubmission.count({ where: { call: { coordinatorId: actor.id }, status: "UNDER_REVIEW" } }),
    prisma.reviewerAssignment.count({ where: { submission: { call: { coordinatorId: actor.id } }, supersededAt: null, status: { in: ["PENDING", "ACCEPTED"] }, dueAt: { lt: now } } }),
    prisma.researchSubmission.findMany({ where: { call: { coordinatorId: actor.id }, status: "UNDER_REVIEW" }, select: { assignments: { where: { supersededAt: null }, select: { status: true, review: { select: { submittedAt: true } } } } } }),
    prisma.researchSubmission.findMany({ where: { call: { coordinatorId: actor.id } }, select: { id: true, title: true, referenceNumber: true, status: true, updatedAt: true, call: { select: { title: true } }, researcher: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 6 }),
  ]);
  const decisions = candidates.filter((submission) => submission.assignments.length > 0 && submission.assignments.every((assignment) => assignment.status === "COMPLETED" && assignment.review?.submittedAt)).length;
  const numbers: Record<string, number> = { screening: awaitingScreening, assignment: awaitingAssignment, decision: decisions };
  return <main className="workspace-page">
    <div className="workspace-welcome"><div><p className="eyebrow">Research coordination</p><h1>Good day, {actor.name?.split(" ")[0] || "Coordinator"}</h1><p>Review the research programme and act on the work that needs your attention.</p></div><Link href="/coordinator/calls#new-call" className="button button-primary">Create a research call</Link></div>
    <section className="metric-grid coordinator-metrics"><Card><span>Research calls</span><strong>{calls}</strong><small>{openCalls} open for submissions</small></Card><Card><span>Total submissions</span><strong>{totalSubmissions}</strong><small>Across calls you coordinate</small></Card><Card><span>Reviews in progress</span><strong>{inReview}</strong><small>{overdue} overdue assignment(s)</small></Card><Card><span>Decision-ready</span><strong>{decisions}</strong><small>All active reviews are in</small></Card></section>
    <section className="coordinator-overview-grid"><div className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Action queue</p><h2>Work requiring attention</h2></div></div><div className="coordinator-task-list">{tasks.map((task) => <Link href={task.href} key={task.key}><span><strong>{task.label}</strong><small>{task.description}</small></span><b>{numbers[task.key]}</b></Link>)}</div></div>
      <div className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Call calendar</p><h2>Programme status</h2></div><Link href="/coordinator/calls" className="text-link">Manage calls →</Link></div><p className="overview-stat"><strong>{openCalls}</strong><span>of {calls} calls currently accepting submissions</span></p><p className="muted-copy">Account and access administration is handled by the system administrator.</p></div></section>
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Recent activity</p><h2>Recently updated submissions</h2></div><Link href="/coordinator/screening" className="text-link">Open screening queue →</Link></div><div className="recent-submissions">{latest.map((submission) => <Link href={`/coordinator/submissions/${submission.id}`} key={submission.id}><span><strong>{submission.title}</strong><small>{submission.referenceNumber} · {submission.call.title} · {submission.researcher.name}</small></span><span className={"status-pill status-" + submission.status.toLowerCase()}>{submission.status.replaceAll("_", " ")}</span><time>{submission.updatedAt.toLocaleDateString()}</time></Link>)}{latest.length === 0 && <p className="empty-copy">Submissions will appear here when researchers respond to an open call.</p>}</div></section>
  </main>;
}
