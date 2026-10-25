import Link from "next/link";
import { Card } from "@/components/ui/card";
import { requireAdministrator } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Administration overview" };
export default async function AdminPage() {
  await requireAdministrator();
  const [admins, coordinators, reviewers, researchers, pendingResearchers, inactive, recent] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
    prisma.user.count({ where: { role: "COORDINATOR", isActive: true } }),
    prisma.user.count({ where: { role: "REVIEWER", isActive: true } }),
    prisma.user.count({ where: { role: "RESEARCHER", isActive: true } }),
    prisma.user.count({ where: { role: "RESEARCHER", isActive: true, emailVerifiedAt: null } }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" }, select: { id: true, action: true, resourceType: true, resourceId: true, createdAt: true, actor: { select: { name: true, role: true } } } }),
  ]);
  return <main className="workspace-page">
    <div className="workspace-welcome"><div><p className="eyebrow">System administration</p><h1>Administrator overview</h1><p>Manage accounts and inspect the system’s administrative record. Research-call decisions remain with the research coordinator.</p></div><Link href="/admin/accounts" className="button button-primary">Manage accounts</Link></div>
    <section className="metric-grid coordinator-metrics"><Card><span>Administrators</span><strong>{admins}</strong><small>Active system administrators</small></Card><Card><span>Coordinators</span><strong>{coordinators}</strong><small>Research workflow managers</small></Card><Card><span>Reviewers</span><strong>{reviewers}</strong><small>University review panel</small></Card><Card><span>Researchers</span><strong>{researchers}</strong><small>{pendingResearchers} pending verification</small></Card></section>
    <section className="coordinator-overview-grid"><div className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Access control</p><h2>Account status</h2></div></div><p className="overview-stat"><strong>{inactive}</strong><span>inactive account(s) cannot sign in; their sessions have been revoked</span></p><div className="overview-links"><Link href="/admin/accounts">Account directory <span>→</span></Link><Link href="/admin/audit-logs">Full audit record <span>→</span></Link></div></div>
    <div className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Role boundaries</p><h2>Separate duties</h2></div></div><ul className="admin-duty-list"><li><strong>Administrator</strong><span>Accounts, access and audit oversight</span></li><li><strong>Coordinator</strong><span>Calls, screening, reviews and decisions</span></li><li><strong>Reviewer</strong><span>Assigned peer assessments</span></li><li><strong>Researcher</strong><span>Own submissions and revisions</span></li></ul></div></section>
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Accountability</p><h2>Recent administrative events</h2></div><Link href="/admin/audit-logs" className="text-link">View audit log →</Link></div><div className="recent-submissions">{recent.map((entry) => <div className="audit-entry-heading" key={entry.id}><span><strong>{entry.action.replaceAll("_", " ")}</strong><small>{entry.actor?.name ?? "System"} · {entry.resourceType} · {entry.resourceId}</small></span><time>{entry.createdAt.toLocaleString()}</time></div>)}{recent.length === 0 && <p className="empty-copy">Administrative and workflow events will be recorded here.</p>}</div></section>
  </main>;
}
