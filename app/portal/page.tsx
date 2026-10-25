import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { SubmissionCards } from "@/components/researcher/submission-cards";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Researcher portal" };
export default async function PortalPage() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role === "ADMIN") redirect("/admin");
  if (actor.role === "COORDINATOR") redirect("/coordinator");
  if (actor.role === "REVIEWER") redirect("/reviewer");
  const [submissions, total, active, revisions, accepted, rejected, notifications] = await Promise.all([
    prisma.researchSubmission.findMany({ where: { researcherId: actor.id }, include: { call: { select: { title: true } }, decisions: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" }, take: 4 }),
    prisma.researchSubmission.count({ where: { researcherId: actor.id } }),
    prisma.researchSubmission.count({ where: { researcherId: actor.id, status: { in: ["SUBMITTED", "ELIGIBLE_FOR_REVIEW", "UNDER_REVIEW"] } } }),
    prisma.researchSubmission.count({ where: { researcherId: actor.id, status: { in: ["REVISION_REQUESTED", "RETURNED_FOR_CORRECTION"] } } }),
    prisma.researchSubmission.count({ where: { researcherId: actor.id, status: "ACCEPTED" } }),
    prisma.researchSubmission.count({ where: { researcherId: actor.id, status: "REJECTED" } }),
    prisma.notification.findMany({ where: { userId: actor.id, readAt: null }, orderBy: { createdAt: "desc" }, take: 5 }),
  ]);
  return <main className="workspace-page"><div className="workspace-welcome"><div><p className="eyebrow">Private researcher area</p><h1>Welcome, {actor.name?.split(" ")[0] || "Researcher"}</h1><p>Follow your research submissions, revision requests and final decisions.</p></div><Link href="/submit" className="button button-primary">New submission</Link></div><div className="metric-grid coordinator-metrics"><Card><span>Total submissions</span><strong>{total}</strong><small>All calls</small></Card><Card><span>Under consideration</span><strong>{active}</strong><small>Submitted or in review</small></Card><Card><span>Revisions requested</span><strong>{revisions}</strong><small>Action may be required</small></Card><Card><span>Final outcomes</span><strong>{accepted + rejected}</strong><small>{accepted} accepted · {rejected} rejected</small></Card></div>{notifications.length > 0 && <section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Updates</p><h2>Recent notifications</h2></div></div><div className="notification-list">{notifications.map((item) => <div key={item.id}><strong>{item.title}</strong><p>{item.body}</p></div>)}</div></section>}<section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">My work</p><h2>Recent submissions</h2></div><Link href="/portal/submissions" className="text-link">View all {total} →</Link></div><SubmissionCards submissions={submissions} /></section></main>;
}
