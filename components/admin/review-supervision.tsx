"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AdminAssignment = {
  id: string;
  dueAt: string;
  status: "PENDING" | "ACCEPTED";
  reviewerId: string;
  reviewer: { name: string; email: string };
  submission: {
    id: string;
    referenceNumber: string;
    title: string;
    call: { title: string; coordinator: { name: string } };
  };
};
type Filter = "all" | "overdue" | "soon";
type ReviewDialog =
  | { assignment: AdminAssignment; action: "EXTEND_DEADLINE" }
  | { assignment: AdminAssignment; action: "SEND_REMINDER" };

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function defaultDeadline(dueAt: string) {
  const current = new Date(dueAt);
  const next = new Date(Math.max(current.getTime(), Date.now()));
  next.setDate(next.getDate() + 7);
  return toDateTimeLocal(next);
}

export function AdminReviewSupervision({
  assignments,
  now,
}: {
  assignments: AdminAssignment[];
  now: string;
}) {
  const router = useRouter();
  const nowTime = new Date(now).getTime();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [dialog, setDialog] = useState<ReviewDialog | null>(null);
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(() => {
    const overdue = assignments.filter(
      (assignment) => new Date(assignment.dueAt).getTime() < nowTime,
    ).length;
    const soon = assignments.filter((assignment) => {
      const due = new Date(assignment.dueAt).getTime();
      return due >= nowTime && due - nowTime < 7 * 86_400_000;
    }).length;
    return { overdue, soon };
  }, [assignments, nowTime]);

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const due = new Date(assignment.dueAt).getTime();
      if (filter === "overdue" && due >= nowTime) return false;
      if (
        filter === "soon" &&
        (due < nowTime || due - nowTime >= 7 * 86_400_000)
      ) {
        return false;
      }
      if (!search) return true;
      return [
        assignment.reviewer.name,
        assignment.reviewer.email,
        assignment.submission.referenceNumber,
        assignment.submission.title,
        assignment.submission.call.title,
        assignment.submission.call.coordinator.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [assignments, filter, nowTime, query]);

  function openDialog(next: ReviewDialog) {
    setDialog(next);
    setReason("");
    setError("");
    setNotice("");
    setDeadline(
      next.action === "EXTEND_DEADLINE"
        ? defaultDeadline(next.assignment.dueAt)
        : "",
    );
  }

  function closeDialog() {
    setDialog(null);
    setReason("");
    setDeadline("");
    setError("");
  }

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    setError("");
    const payload =
      dialog.action === "EXTEND_DEADLINE"
        ? {
            action: dialog.action,
            dueAt: new Date(deadline).toISOString(),
            reason: reason.trim(),
          }
        : { action: dialog.action };
    try {
      const response = await fetch(
        `/api/admin/reviews/${dialog.assignment.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The review assignment could not be updated.");
        return;
      }
      setNotice(
        dialog.action === "SEND_REMINDER"
          ? "Reminder sent to the reviewer and recorded in the audit log."
          : "Deadline extended. The reviewer has been notified.",
      );
      closeDialog();
      router.refresh();
    } catch {
      setError("Could not reach the review supervision service.");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    !busy &&
    (dialog?.action !== "EXTEND_DEADLINE" ||
      (Boolean(deadline) && reason.trim().length >= 10));

  return (
    <main className="workspace-page">
      <div className="workspace-welcome admin-welcome">
        <div>
          <p className="eyebrow">Review supervision</p>
          <h1>Reviewer commitments</h1>
          <p>
            Track live review assignments, extend deadlines, and send reminders
            when reviews stall. Coordinators and reviewers are notified of every
            intervention.
          </p>
        </div>
      </div>

      <section className="admin-kpi-grid admin-oversight-kpis">
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Active reviews</span>
            <strong>{assignments.length}</strong>
            <small>Pending or accepted assignments</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Overdue</span>
            <strong>{stats.overdue}</strong>
            <small>Past the assigned deadline</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Due within 7 days</span>
            <strong>{stats.soon}</strong>
            <small>Approaching their deadline</small>
          </div>
        </div>
      </section>

      {notice && (
        <p className="form-message" role="status">
          {notice}
        </p>
      )}

      <section className="workspace-panel">
        <div className="workspace-panel-heading admin-activity-heading">
          <div>
            <p className="eyebrow">Assignment register</p>
            <h2>Live review work</h2>
          </div>
          <span className="workspace-count">{filtered.length} shown</span>
        </div>

        <div className="admin-review-toolbar">
          <label>
            <span className="sr-only">Search review assignments</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reviewer, submission or call"
            />
          </label>
          <div className="admin-filter-tabs" role="group" aria-label="Filter reviews">
            {(["all", "overdue", "soon"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : undefined}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "overdue"
                    ? "Overdue"
                    : "Due soon"}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-review-list">
          {filtered.map((assignment) => {
            const due = new Date(assignment.dueAt);
            const overdue = due.getTime() < nowTime;
            const soon =
              !overdue && due.getTime() - nowTime < 7 * 86_400_000;
            return (
              <article className="admin-review-row" key={assignment.id}>
                <div className="admin-review-reviewer">
                  <strong>{assignment.reviewer.name}</strong>
                  <small>{assignment.reviewer.email}</small>
                </div>
                <div className="admin-review-submission">
                  <span>{assignment.submission.referenceNumber}</span>
                  <strong>{assignment.submission.title}</strong>
                  <small>
                    {assignment.submission.call.title} ·{" "}
                    {assignment.submission.call.coordinator.name}
                  </small>
                </div>
                <div className="admin-review-deadline">
                  <span
                    className={
                      overdue
                        ? "admin-deadline is-overdue"
                        : soon
                          ? "admin-deadline is-soon"
                          : "admin-deadline"
                    }
                  >
                    {overdue ? "Overdue · " : soon ? "Due soon · " : "Due "}
                    {due.toLocaleDateString()}
                  </span>
                  <small>{assignment.status.toLowerCase()}</small>
                </div>
                <div className="admin-review-actions">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() =>
                      openDialog({ assignment, action: "SEND_REMINDER" })
                    }
                  >
                    Remind
                  </button>
                  <button
                    type="button"
                    className="button button-ghost"
                    onClick={() =>
                      openDialog({ assignment, action: "EXTEND_DEADLINE" })
                    }
                  >
                    Extend
                  </button>
                </div>
              </article>
            );
          })}
          {filtered.length === 0 && (
            <p className="empty-copy">
              {assignments.length === 0
                ? "No active review assignments."
                : "No assignments match this search and filter."}
            </p>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="confirm-dialog admin-action-dialog">
          <DialogHeader>
            <p className="eyebrow">Review supervision</p>
            <DialogTitle>
              {dialog?.action === "SEND_REMINDER"
                ? "Send a deadline reminder"
                : "Extend the review deadline"}
            </DialogTitle>
            <DialogDescription>
              {dialog && (
                <>
                  {dialog.assignment.reviewer.name} ·{" "}
                  {dialog.assignment.submission.referenceNumber}
                  <br />
                  Current deadline:{" "}
                  {new Date(dialog.assignment.dueAt).toLocaleDateString()}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {dialog?.action === "EXTEND_DEADLINE" && (
            <>
              <label className="dialog-field">
                New review deadline
                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  required
                />
              </label>
              <label className="dialog-reason">
                Administrative reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={10}
                  maxLength={1000}
                  required
                  placeholder="Explain why the deadline is being extended."
                />
              </label>
            </>
          )}

          {dialog?.action === "SEND_REMINDER" && (
            <p className="admin-dialog-note">
              The reviewer receives an in-app notification and, when email is
              configured, an email reminder. The action is recorded against your
              administrator account.
            </p>
          )}

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <button type="button" className="button button-ghost" onClick={closeDialog}>
              Cancel
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={!canSubmit}
              onClick={() => void submit()}
            >
              {busy
                ? "Saving…"
                : dialog?.action === "SEND_REMINDER"
                  ? "Send reminder"
                  : "Extend deadline"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
