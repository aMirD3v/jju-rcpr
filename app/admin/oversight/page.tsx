import Link from "next/link";
import { requireAdministrator } from "@/lib/admin-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Programme oversight" };

function decisionReady(assignments: { status: string; review: { submittedAt: Date | null } | null }[]) {
  return (
    assignments.length > 0 &&
    assignments.every(
      (assignment) =>
        assignment.status === "COMPLETED" && assignment.review?.submittedAt,
    )
  );
}

export default async function AdminOversightPage() {
  await requireAdministrator();
  const now = new Date();
  const [
    calls,
    submissionGroups,
    coordinators,
    overdueAssignments,
    inReview,
    unassignedEligible,
    recentDecisions,
  ] = await Promise.all([
    prisma.researchCall.findMany({
      select: {
        id: true,
        status: true,
        opensAt: true,
        closesAt: true,
        coordinatorId: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.researchSubmission.groupBy({
      by: ["callId", "status"],
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { role: "COORDINATOR", isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.reviewerAssignment.findMany({
      where: {
        supersededAt: null,
        status: { in: ["PENDING", "ACCEPTED"] },
        dueAt: { lt: now },
      },
      select: {
        id: true,
        dueAt: true,
        reviewer: { select: { name: true } },
        submission: {
          select: {
            referenceNumber: true,
            title: true,
            call: { select: { coordinatorId: true } },
          },
        },
      },
      orderBy: { dueAt: "asc" },
    }),
    prisma.researchSubmission.findMany({
      where: { status: "UNDER_REVIEW" },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        updatedAt: true,
        call: { select: { title: true, coordinator: { select: { name: true } } } },
        assignments: {
          where: { supersededAt: null },
          select: {
            status: true,
            review: { select: { submittedAt: true } },
          },
        },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.researchSubmission.findMany({
      where: {
        status: "ELIGIBLE_FOR_REVIEW",
        assignments: {
          none: {
            supersededAt: null,
            status: { in: ["PENDING", "ACCEPTED"] },
          },
        },
      },
      select: {
        id: true,
        referenceNumber: true,
        title: true,
        updatedAt: true,
        call: { select: { title: true, coordinator: { select: { name: true } } } },
      },
      orderBy: { updatedAt: "asc" },
    }),
    prisma.researchDecision.findMany({
      where: {
        status: { in: ["ACCEPTED", "REJECTED"] },
        submission: { status: { in: ["ACCEPTED", "REJECTED"] } },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        submission: {
          select: {
            id: true,
            referenceNumber: true,
            title: true,
            call: { select: { title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const openCalls = calls.filter(
    (call) =>
      call.status === "OPEN" &&
      call.opensAt <= now &&
      call.closesAt >= now,
  ).length;
  const totalSubmissions = submissionGroups.reduce(
    (total, group) => total + group._count._all,
    0,
  );
  const underReview = submissionGroups
    .filter((group) => group.status === "UNDER_REVIEW")
    .reduce((total, group) => total + group._count._all, 0);
  const ready = inReview.filter((submission) => decisionReady(submission.assignments));

  const workload = new Map(
    coordinators.map((coordinator) => [
      coordinator.id,
      {
        calls: 0,
        openCalls: 0,
        submissions: 0,
        underReview: 0,
        overdue: 0,
      },
    ]),
  );
  const callOwners = new Map(calls.map((call) => [call.id, call.coordinatorId]));
  for (const call of calls) {
    const entry = workload.get(call.coordinatorId);
    if (!entry) continue;
    entry.calls += 1;
    if (
      call.status === "OPEN" &&
      call.opensAt <= now &&
      call.closesAt >= now
    ) {
      entry.openCalls += 1;
    }
  }
  for (const group of submissionGroups) {
    const owner = callOwners.get(group.callId);
    const entry = owner ? workload.get(owner) : undefined;
    if (!entry) continue;
    entry.submissions += group._count._all;
    if (group.status === "UNDER_REVIEW") entry.underReview += group._count._all;
  }
  for (const assignment of overdueAssignments) {
    const entry = workload.get(assignment.submission.call.coordinatorId);
    if (entry) entry.overdue += 1;
  }
  const outsideRoster = calls.filter((call) => !workload.has(call.coordinatorId));
  const seenDecisions = new Set<string>();
  const recentFinalDecisions = recentDecisions
    .filter((decision) => {
      if (seenDecisions.has(decision.submission.id)) return false;
      seenDecisions.add(decision.submission.id);
      return true;
    })
    .slice(0, 5);

  return (
    <main className="workspace-page">
      <div className="workspace-welcome admin-welcome">
        <div>
          <p className="eyebrow">Programme oversight</p>
          <h1>Research activity at a glance</h1>
          <p>
            Monitor coordinator workload, find stalled reviews, and act where
            the programme needs intervention.
          </p>
        </div>
        <div className="admin-welcome-actions">
          <Link href="/admin/calls" className="button button-primary">
            Supervise calls
          </Link>
          <Link href="/admin/decisions" className="button button-secondary">
            Review decisions
          </Link>
        </div>
      </div>

      <section className="admin-kpi-grid admin-oversight-kpis">
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Open calls</span>
            <strong>{openCalls}</strong>
            <small>Accepting submissions now</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Submissions</span>
            <strong>{totalSubmissions}</strong>
            <small>Across the whole programme</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Under review</span>
            <strong>{underReview}</strong>
            <small>Active review rounds</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Decision-ready</span>
            <strong>{ready.length}</strong>
            <small>All active reviews submitted</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Overdue reviews</span>
            <strong>{overdueAssignments.length}</strong>
            <small>Past the assigned deadline</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Unassigned eligible</span>
            <strong>{unassignedEligible.length}</strong>
            <small>Eligible work without reviewers</small>
          </div>
        </div>
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-heading admin-activity-heading">
          <div>
            <p className="eyebrow">Distribution of work</p>
            <h2>Coordinator workload</h2>
          </div>
          <Link href="/admin/calls" className="text-link">
            Reassign calls →
          </Link>
        </div>
        {coordinators.length === 0 ? (
          <p className="empty-copy">No active coordinator accounts.</p>
        ) : (
          <div className="admin-workload">
            <div className="admin-workload-head" aria-hidden="true">
              <span>Coordinator</span>
              <span>Calls</span>
              <span>Submissions</span>
              <span>Under review</span>
              <span>Overdue</span>
            </div>
            {coordinators.map((coordinator) => {
              const entry = workload.get(coordinator.id);
              if (!entry) return null;
              return (
                <div className="admin-workload-row" key={coordinator.id}>
                  <div className="admin-workload-person">
                    <strong>{coordinator.name}</strong>
                    <small>{coordinator.email}</small>
                  </div>
                  <span>
                    <b>{entry.calls}</b>
                    <small>{entry.openCalls} open</small>
                  </span>
                  <span>
                    <b>{entry.submissions}</b>
                    <small>total</small>
                  </span>
                  <span>
                    <b>{entry.underReview}</b>
                    <small>in progress</small>
                  </span>
                  <span className={entry.overdue > 0 ? "is-alert" : undefined}>
                    <b>{entry.overdue}</b>
                    <small>{entry.overdue > 0 ? "needs action" : "on track"}</small>
                  </span>
                </div>
              );
            })}
            {outsideRoster.length > 0 && (
              <p className="admin-workload-note">
                {outsideRoster.length} call
                {outsideRoster.length === 1 ? " is" : "s are"} assigned outside
                the active coordinator roster. Reassign{" "}
                {outsideRoster.length === 1 ? "it" : "them"} from call
                supervision.
              </p>
            )}
          </div>
        )}
      </section>

      <section className="admin-overview-grid">
        <div className="workspace-panel">
          <div className="workspace-panel-heading admin-activity-heading">
            <div>
              <p className="eyebrow">Escalations</p>
              <h2>Reviews needing attention</h2>
            </div>
            <Link href="/admin/reviews" className="text-link">
              Open reviews →
            </Link>
          </div>
          <div className="admin-escalation-list">
            {overdueAssignments.slice(0, 6).map((assignment) => {
              const days = Math.max(
                1,
                Math.ceil(
                  (now.getTime() - assignment.dueAt.getTime()) / 86_400_000,
                ),
              );
              return (
                <div className="admin-escalation" key={assignment.id}>
                  <span>
                    <strong>{assignment.submission.referenceNumber}</strong>
                    <small>
                      {assignment.reviewer.name} ·{" "}
                      {assignment.submission.title}
                    </small>
                  </span>
                  <span className="admin-deadline is-overdue">
                    {days} day{days === 1 ? "" : "s"} overdue
                  </span>
                </div>
              );
            })}
            {overdueAssignments.length === 0 && (
              <p className="empty-copy">
                No review assignment is past its deadline.
              </p>
            )}
          </div>
        </div>

        <div className="workspace-panel">
          <div className="workspace-panel-heading admin-activity-heading">
            <div>
              <p className="eyebrow">Decision pipeline</p>
              <h2>Awaiting a decision</h2>
            </div>
            <Link href="/admin/decisions" className="text-link">
              Open decisions →
            </Link>
          </div>
          <div className="admin-escalation-list">
            {ready.slice(0, 4).map((submission) => (
              <div className="admin-escalation" key={submission.id}>
                <span>
                  <strong>{submission.referenceNumber}</strong>
                  <small>
                    {submission.title} · {submission.call.coordinator.name}
                  </small>
                </span>
                <span className="status-pill status-eligible_for_review">
                  Ready
                </span>
              </div>
            ))}
            {unassignedEligible.slice(0, 3).map((submission) => (
              <div className="admin-escalation" key={submission.id}>
                <span>
                  <strong>{submission.referenceNumber}</strong>
                  <small>
                    {submission.title} · {submission.call.coordinator.name}
                  </small>
                </span>
                <span className="status-pill status-pending">Unassigned</span>
              </div>
            ))}
            {ready.length === 0 && unassignedEligible.length === 0 && (
              <p className="empty-copy">
                No submission is waiting for reviewer assignment or a decision.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="workspace-panel">
        <div className="workspace-panel-heading admin-activity-heading">
          <div>
            <p className="eyebrow">Final decisions</p>
            <h2>Recently concluded</h2>
          </div>
          <Link href="/admin/decisions" className="text-link">
            Inspect decisions →
          </Link>
        </div>
        <div className="recent-submissions">
          {recentFinalDecisions.map((decision) => (
            <Link
              href="/admin/decisions"
              key={decision.id}
              className="admin-decision-link"
            >
              <span>
                <strong>{decision.submission.title}</strong>
                <small>
                  {decision.submission.referenceNumber} ·{" "}
                  {decision.submission.call.title}
                </small>
              </span>
              <span
                className={
                  "status-pill status-" + decision.status.toLowerCase()
                }
              >
                {decision.status}
              </span>
              <time>{decision.createdAt.toLocaleDateString()}</time>
            </Link>
          ))}
          {recentFinalDecisions.length === 0 && (
            <p className="empty-copy">No final decisions have been recorded.</p>
          )}
        </div>
      </section>
    </main>
  );
}
