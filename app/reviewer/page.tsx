import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const metadata = { title: "Reviewer workspace" };
export default async function ReviewerPage() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role !== "REVIEWER") redirect(actor.role === "ADMIN" ? "/admin" : actor.role === "COORDINATOR" ? "/coordinator" : "/portal");
  const [pending, active, completed, overdue] = await Promise.all([
    prisma.reviewerAssignment.count({ where: { reviewerId: actor.id, supersededAt: null, status: "PENDING" } }),
    prisma.reviewerAssignment.count({ where: { reviewerId: actor.id, supersededAt: null, status: "ACCEPTED" } }),
    prisma.reviewerAssignment.count({ where: { reviewerId: actor.id, supersededAt: null, status: "COMPLETED" } }),
    prisma.reviewerAssignment.count({ where: { reviewerId: actor.id, supersededAt: null, status: { in: ["PENDING", "ACCEPTED"] }, dueAt: { lt: new Date() } } }),
  ]);
  return <main className="workspace-page"><div className="workspace-welcome"><div><p className="eyebrow">University reviewer</p><h1>Review overview</h1><p>Manage your assigned work and return to the reviews you have completed. Researcher identity and confidential coordinator notes remain protected.</p></div><Link href="/reviewer/assignments" className="button button-primary">Open assignments</Link></div><div className="metric-grid coordinator-metrics"><section className="card"><span>Awaiting response</span><strong>{pending}</strong><small>New assignments</small></section><section className="card"><span>In progress</span><strong>{active}</strong><small>{overdue} overdue</small></section><section className="card"><span>Completed reviews</span><strong>{completed}</strong><small>Submitted recommendations</small></section></div><div className="coordinator-overview-grid"><Link href="/reviewer/assignments" className="workspace-panel role-action-card"><p className="eyebrow">Work queue</p><h2>Review assignments</h2><p>Accept assignments, declare conflicts, and submit structured assessments.</p><strong>{pending + active} open item(s) →</strong></Link><Link href="/reviewer/history" className="workspace-panel role-action-card"><p className="eyebrow">Past work</p><h2>Review history</h2><p>Return to submitted reviews and closed assignments.</p><strong>{completed} completed review(s) →</strong></Link></div></main>;
}
