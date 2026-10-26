import Link from "next/link";
import {
  Briefcase,
  ClipboardCheck,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { requireAdministrator } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Administration overview" };

function actionTone(action: string) {
  if (/DEACTIV|REVOK|DELETE|DECLIN|REJECT/.test(action)) return "is-danger";
  if (/CREATE|REGISTER|VERIFY|ACTIVATE|ACCEPT/.test(action)) return "is-success";
  if (/RESET|UPDATE|REVISION|RETURN/.test(action)) return "is-warning";
  return "";
}

export default async function AdminPage() {
  await requireAdministrator();
  const now = new Date();
  const [
    admins,
    coordinators,
    reviewers,
    researchers,
    pendingResearchers,
    inactive,
    openCalls,
    underReview,
    overdueReviews,
    recent,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
    prisma.user.count({ where: { role: "COORDINATOR", isActive: true } }),
    prisma.user.count({ where: { role: "REVIEWER", isActive: true } }),
    prisma.user.count({ where: { role: "RESEARCHER", isActive: true } }),
    prisma.user.count({
      where: { role: "RESEARCHER", isActive: true, emailVerifiedAt: null },
    }),
    prisma.user.count({ where: { isActive: false } }),
    prisma.researchCall.count({
      where: {
        status: "OPEN",
        opensAt: { lte: now },
        closesAt: { gte: now },
      },
    }),
    prisma.researchSubmission.count({ where: { status: "UNDER_REVIEW" } }),
    prisma.reviewerAssignment.count({
      where: {
        supersededAt: null,
        status: { in: ["PENDING", "ACCEPTED"] },
        dueAt: { lt: now },
      },
    }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
        actor: { select: { name: true, role: true } },
      },
    }),
  ]);

  const metrics = [
    {
      label: "Administrators",
      value: admins,
      detail: "Active system administrators",
      icon: ShieldCheck,
    },
    {
      label: "Coordinators",
      value: coordinators,
      detail: "Research workflow managers",
      icon: Briefcase,
    },
    {
      label: "Reviewers",
      value: reviewers,
      detail: "University review panel",
      icon: ClipboardCheck,
    },
    {
      label: "Researchers",
      value: researchers,
      detail: `${pendingResearchers} pending verification`,
      icon: GraduationCap,
    },
  ];

  return (
    <main className="workspace-page admin-overview">
      <div className="workspace-welcome admin-welcome">
        <div>
          <p className="eyebrow">System administration</p>
          <h1>Administrator overview</h1>
          <p>
            Supervise the research programme, intervene where work is blocked,
            manage accounts, and inspect the system&apos;s administrative
            record.
          </p>
        </div>
        <div className="admin-welcome-actions">
          <Link href="/admin/oversight" className="button button-primary">
            Open programme oversight
          </Link>
          <Link href="/admin/accounts" className="button button-secondary">
            Manage accounts
          </Link>
        </div>
      </div>

      <section className="admin-kpi-grid" aria-label="Account totals">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <article className="admin-kpi" key={label}>
            <span className="admin-kpi-icon">
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <div className="admin-kpi-copy">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{detail}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-overview-grid">
        <div className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <p className="eyebrow">Access control</p>
              <h2>Account status</h2>
            </div>
          </div>
          <div className="admin-status-figures">
            <div className="admin-status-figure">
              <strong>{inactive}</strong>
              <span>Inactive accounts</span>
              <small>
                Inactive accounts cannot sign in and their sessions are revoked.
              </small>
            </div>
            <div className="admin-status-figure">
              <strong>{pendingResearchers}</strong>
              <span>Pending verification</span>
              <small>
                Guest researchers awaiting a completed identity check.
              </small>
            </div>
          </div>
          <div className="overview-links">
            <Link href="/admin/accounts">
              Review the account directory <span aria-hidden="true">→</span>
            </Link>
            <Link href="/admin/audit-logs">
              Read the full audit record <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        <div className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <p className="eyebrow">Role boundaries</p>
              <h2>Separate duties</h2>
            </div>
          </div>
          <ul className="admin-duty-list">
            <li>
              <strong>Administrator</strong>
              <span>Programme oversight, interventions, accounts and audit</span>
            </li>
            <li>
              <strong>Coordinator</strong>
              <span>Day-to-day calls, screening, reviews and decisions</span>
            </li>
            <li>
              <strong>Reviewer</strong>
              <span>Assigned peer assessments</span>
            </li>
            <li>
              <strong>Researcher</strong>
              <span>Own submissions and revisions</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-heading admin-activity-heading">
          <div>
            <p className="eyebrow">Programme supervision</p>
            <h2>Live research activity</h2>
          </div>
          <Link href="/admin/oversight" className="text-link">
            Open oversight →
          </Link>
        </div>
        <div className="admin-programme-snapshot">
          <div>
            <strong>{openCalls}</strong>
            <span>Open calls</span>
            <small>Currently accepting submissions</small>
          </div>
          <div>
            <strong>{underReview}</strong>
            <span>Under review</span>
            <small>Submissions in an active review round</small>
          </div>
          <div>
            <strong>{overdueReviews}</strong>
            <span>Overdue reviews</span>
            <small>Assignments past their review deadline</small>
          </div>
        </div>
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-heading admin-activity-heading">
          <div>
            <p className="eyebrow">Accountability</p>
            <h2>Recent administrative events</h2>
          </div>
          <Link href="/admin/audit-logs" className="text-link">
            View audit log →
          </Link>
        </div>
        <div className="admin-event-list">
          {recent.map((entry) => (
            <article className="admin-event" key={entry.id}>
              <span
                className={`admin-event-dot ${actionTone(entry.action)}`}
                aria-hidden="true"
              />
              <div className="admin-event-copy">
                <strong>{entry.action.replaceAll("_", " ")}</strong>
                <span>
                  {entry.actor?.name ?? "System"} · {entry.resourceType}{" "}
                  <code>{entry.resourceId}</code>
                </span>
              </div>
              <time dateTime={entry.createdAt.toISOString()}>
                {entry.createdAt.toLocaleString()}
              </time>
            </article>
          ))}
          {recent.length === 0 && (
            <p className="admin-empty">
              Administrative and workflow events will be recorded here.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
