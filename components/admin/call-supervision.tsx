"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AdminCall = {
  id: string;
  title: string;
  status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED";
  opensAt: string;
  closesAt: string;
  coordinatorId: string;
  coordinator: { name: string; email: string };
  _count: { submissions: number };
};
type Coordinator = { id: string; name: string; email: string };
type CallStatus = "OPEN" | "CLOSED" | "ARCHIVED";
type CallDialog =
  | { call: AdminCall; action: "SET_STATUS"; status: CallStatus }
  | { call: AdminCall; action: "EXTEND_DEADLINE" }
  | { call: AdminCall; action: "REASSIGN" };

function toDateTimeLocal(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function defaultDeadline(call: AdminCall) {
  const current = new Date(call.closesAt);
  const next = new Date(Math.max(current.getTime(), Date.now()));
  next.setDate(next.getDate() + 7);
  return toDateTimeLocal(next);
}

function statusActions(call: AdminCall): { label: string; status: CallStatus }[] {
  if (call.status === "ARCHIVED") {
    return [{ label: "Restore call", status: "CLOSED" }];
  }
  const actions: { label: string; status: CallStatus }[] = [];
  if (call.status === "DRAFT" || call.status === "CLOSED") {
    actions.push({ label: "Open call", status: "OPEN" });
  }
  if (call.status === "OPEN") {
    actions.push({ label: "Close call", status: "CLOSED" });
  }
  actions.push({ label: "Archive", status: "ARCHIVED" });
  return actions;
}

function dialogTitle(dialog: CallDialog) {
  if (dialog.action === "EXTEND_DEADLINE") return "Extend the submission deadline";
  if (dialog.action === "REASSIGN") return "Reassign the coordinator";
  if (dialog.status === "OPEN") return "Open this research call";
  if (dialog.status === "CLOSED") return "Close this research call";
  return "Archive this research call";
}

export function AdminCallSupervision({
  calls,
  coordinators,
  now,
}: {
  calls: AdminCall[];
  coordinators: Coordinator[];
  now: string;
}) {
  const router = useRouter();
  const nowTime = new Date(now).getTime();
  const [dialog, setDialog] = useState<CallDialog | null>(null);
  const [reason, setReason] = useState("");
  const [deadline, setDeadline] = useState("");
  const [coordinatorId, setCoordinatorId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const counts = {
    open: calls.filter((call) => call.status === "OPEN").length,
    closed: calls.filter((call) => call.status === "CLOSED").length,
    archived: calls.filter((call) => call.status === "ARCHIVED").length,
  };

  function openDialog(next: CallDialog) {
    setDialog(next);
    setReason("");
    setError("");
    setNotice("");
    setDeadline(next.action === "EXTEND_DEADLINE" ? defaultDeadline(next.call) : "");
    setCoordinatorId("");
  }

  function closeDialog() {
    setDialog(null);
    setReason("");
    setError("");
    setDeadline("");
    setCoordinatorId("");
  }

  async function submit() {
    if (!dialog) return;
    setBusy(true);
    setError("");
    const payload =
      dialog.action === "SET_STATUS"
        ? {
            action: dialog.action,
            status: dialog.status,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          }
        : dialog.action === "EXTEND_DEADLINE"
          ? {
              action: dialog.action,
              closesAt: new Date(deadline).toISOString(),
              reason: reason.trim(),
            }
          : {
              action: dialog.action,
              coordinatorId,
              reason: reason.trim(),
            };
    try {
      const response = await fetch(`/api/admin/calls/${dialog.call.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The call could not be updated.");
        return;
      }
      setNotice("Call updated. The coordinator has been notified.");
      closeDialog();
      router.refresh();
    } catch {
      setError("Could not reach the call supervision service.");
    } finally {
      setBusy(false);
    }
  }

  const needsReason =
    dialog?.action !== "SET_STATUS" || dialog?.status !== "OPEN";
  const canSubmit =
    !busy &&
    (!needsReason || reason.trim().length >= 10) &&
    (dialog?.action !== "EXTEND_DEADLINE" || Boolean(deadline)) &&
    (dialog?.action !== "REASSIGN" || Boolean(coordinatorId));

  return (
    <main className="workspace-page">
      <div className="workspace-welcome admin-welcome">
        <div>
          <p className="eyebrow">Call supervision</p>
          <h1>Research call lifecycle</h1>
          <p>
            Open, close, archive, extend, or reassign any research call. Every
            intervention is recorded in the audit log.
          </p>
        </div>
      </div>

      <section className="admin-kpi-grid">
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Total calls</span>
            <strong>{calls.length}</strong>
            <small>Across the programme</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Open</span>
            <strong>{counts.open}</strong>
            <small>Status set to open</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Closed</span>
            <strong>{counts.closed}</strong>
            <small>No longer accepting work</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Archived</span>
            <strong>{counts.archived}</strong>
            <small>Retained for the record</small>
          </div>
        </div>
      </section>

      {notice && (
        <p className="form-message" role="status">
          {notice}
        </p>
      )}

      <section className="workspace-panel" id="calls">
        <div className="workspace-panel-heading admin-activity-heading">
          <div>
            <p className="eyebrow">Call register</p>
            <h2>All research calls</h2>
          </div>
          <span className="workspace-count">{calls.length} total</span>
        </div>
        <div className="admin-call-list">
          {calls.map((call) => {
            const closes = new Date(call.closesAt);
            const deadlinePassed =
              call.status === "OPEN" && closes.getTime() < nowTime;
            const endingSoon =
              call.status === "OPEN" &&
              !deadlinePassed &&
              closes.getTime() - nowTime < 7 * 86_400_000;
            return (
              <article className="admin-call-row" key={call.id}>
                <div className="admin-call-head">
                  <div className="admin-call-copy">
                    <p className="eyebrow">
                      {call._count.submissions} submission
                      {call._count.submissions === 1 ? "" : "s"} ·{" "}
                      {call.coordinator.name}
                    </p>
                    <h2>{call.title}</h2>
                    <p>
                      Opens {new Date(call.opensAt).toLocaleDateString()} ·
                      Closes{" "}
                      <span
                        className={
                          deadlinePassed
                            ? "is-overdue"
                            : endingSoon
                              ? "is-soon"
                              : undefined
                        }
                      >
                        {closes.toLocaleDateString()}
                      </span>
                      {deadlinePassed ? " (deadline passed)" : ""}
                    </p>
                  </div>
                  <span
                    className={
                      "status-pill status-" + call.status.toLowerCase()
                    }
                  >
                    {call.status}
                  </span>
                </div>
                <div className="admin-call-actions">
                  {statusActions(call).map((action) => (
                    <button
                      key={action.status}
                      type="button"
                      className={
                        action.status === "ARCHIVED"
                          ? "button button-ghost"
                          : "button button-secondary"
                      }
                      onClick={() =>
                        openDialog({ call, action: "SET_STATUS", status: action.status })
                      }
                    >
                      {action.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => openDialog({ call, action: "EXTEND_DEADLINE" })}
                  >
                    Extend deadline
                  </button>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => openDialog({ call, action: "REASSIGN" })}
                  >
                    Reassign coordinator
                  </button>
                </div>
              </article>
            );
          })}
          {calls.length === 0 && (
            <p className="empty-copy">
              No research calls have been created yet.
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
            <p className="eyebrow">Call supervision</p>
            <DialogTitle>{dialog ? dialogTitle(dialog) : "Supervise call"}</DialogTitle>
            <DialogDescription>
              {dialog?.call.title}
              {dialog?.call.coordinator.name
                ? ` · ${dialog.call.coordinator.name}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {dialog?.action === "EXTEND_DEADLINE" && (
            <label className="dialog-field">
              New submission deadline
              <input
                type="datetime-local"
                value={deadline}
                onChange={(event) => setDeadline(event.target.value)}
                required
              />
            </label>
          )}

          {dialog?.action === "REASSIGN" && (
            <label className="dialog-field">
              New coordinator
              <select
                value={coordinatorId}
                onChange={(event) => setCoordinatorId(event.target.value)}
                required
              >
                <option value="">Select a coordinator</option>
                {coordinators
                  .filter((coordinator) => coordinator.id !== dialog.call.coordinatorId)
                  .map((coordinator) => (
                    <option key={coordinator.id} value={coordinator.id}>
                      {coordinator.name} ({coordinator.email})
                    </option>
                  ))}
              </select>
            </label>
          )}

          {needsReason && (
            <label className="dialog-reason">
              Administrative reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={10}
                maxLength={1000}
                required
                placeholder="Record why this intervention is necessary."
              />
            </label>
          )}

          {dialog?.action === "SET_STATUS" && dialog.status === "OPEN" && (
            <label className="dialog-reason">
              Note <span className="dialog-optional">(optional)</span>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                maxLength={1000}
                placeholder="Add context for the coordinator."
              />
            </label>
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
              {busy ? "Saving…" : "Confirm action"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
