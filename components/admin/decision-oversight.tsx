"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AdminDecision = {
  id: string;
  status: "ACCEPTED" | "REJECTED";
  feedback: string;
  isOverride: boolean;
  overrideReason: string | null;
  createdAt: string;
  decisionMaker: { name: string };
  submission: {
    id: string;
    referenceNumber: string;
    title: string;
    researcher: { name: string; email: string };
    call: { title: string; coordinator: { name: string } };
  };
};
type Filter = "all" | "ACCEPTED" | "REJECTED";

export function AdminDecisionOversight({
  decisions,
}: {
  decisions: AdminDecision[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [reopening, setReopening] = useState<AdminDecision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const stats = useMemo(
    () => ({
      accepted: decisions.filter((decision) => decision.status === "ACCEPTED")
        .length,
      rejected: decisions.filter((decision) => decision.status === "REJECTED")
        .length,
      overrides: decisions.filter((decision) => decision.isOverride).length,
    }),
    [decisions],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return decisions.filter((decision) => {
      if (filter !== "all" && decision.status !== filter) return false;
      if (!search) return true;
      return [
        decision.submission.referenceNumber,
        decision.submission.title,
        decision.submission.researcher.name,
        decision.submission.researcher.email,
        decision.submission.call.title,
        decision.submission.call.coordinator.name,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [decisions, filter, query]);

  function openDialog(decision: AdminDecision) {
    setReopening(decision);
    setReason("");
    setError("");
    setNotice("");
  }

  function closeDialog() {
    setReopening(null);
    setReason("");
    setError("");
  }

  async function submit() {
    if (!reopening) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/decisions/${reopening.submission.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The decision could not be reopened.");
        return;
      }
      setNotice(
        `${reopening.submission.referenceNumber} was reopened. The researcher and coordinator have been notified.`,
      );
      closeDialog();
      router.refresh();
    } catch {
      setError("Could not reach the decision oversight service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="workspace-page">
      <div className="workspace-welcome admin-welcome">
        <div>
          <p className="eyebrow">Decision oversight</p>
          <h1>Final decision register</h1>
          <p>
            Inspect every final decision and reopen a case when new evidence,
            process concerns, or a documented appeal require a fresh review
            round.
          </p>
        </div>
      </div>

      <section className="admin-kpi-grid admin-oversight-kpis">
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Accepted</span>
            <strong>{stats.accepted}</strong>
            <small>Final positive decisions</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Rejected</span>
            <strong>{stats.rejected}</strong>
            <small>Final negative decisions</small>
          </div>
        </div>
        <div className="admin-kpi">
          <div className="admin-kpi-copy">
            <span>Overrides</span>
            <strong>{stats.overrides}</strong>
            <small>Decisions recorded as overrides</small>
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
            <p className="eyebrow">Final decisions</p>
            <h2>Concluded submissions</h2>
          </div>
          <span className="workspace-count">{filtered.length} shown</span>
        </div>

        <div className="admin-review-toolbar">
          <label>
            <span className="sr-only">Search final decisions</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search reference, title, researcher or coordinator"
            />
          </label>
          <div className="admin-filter-tabs" role="group" aria-label="Filter decisions">
            {(["all", "ACCEPTED", "REJECTED"] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={filter === value ? "is-active" : undefined}
                onClick={() => setFilter(value)}
              >
                {value === "all"
                  ? "All"
                  : value === "ACCEPTED"
                    ? "Accepted"
                    : "Rejected"}
              </button>
            ))}
          </div>
        </div>

        <div className="admin-decision-list">
          {filtered.map((decision) => (
            <article className="admin-decision-row" key={decision.id}>
              <div className="admin-decision-main">
                <p className="eyebrow">
                  {decision.submission.referenceNumber} ·{" "}
                  {decision.submission.call.title}
                </p>
                <h2>{decision.submission.title}</h2>
                <p>
                  {decision.submission.researcher.name} ·{" "}
                  {decision.submission.call.coordinator.name}
                </p>
              </div>
              <div className="admin-decision-meta">
                <span
                  className={
                    "status-pill status-" + decision.status.toLowerCase()
                  }
                >
                  {decision.status}
                </span>
                {decision.isOverride && (
                  <span className="account-flag is-pending">
                    <AlertTriangle size={13} aria-hidden="true" />
                    Override
                  </span>
                )}
                <small>
                  {decision.decisionMaker.name} ·{" "}
                  {new Date(decision.createdAt).toLocaleDateString()}
                </small>
              </div>
              <div className="admin-decision-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => openDialog(decision)}
                >
                  Reopen decision
                </button>
              </div>
            </article>
          ))}
          {filtered.length === 0 && (
            <p className="empty-copy">
              {decisions.length === 0
                ? "No final decisions have been recorded."
                : "No decisions match this search and filter."}
            </p>
          )}
        </div>
      </section>

      <Dialog
        open={Boolean(reopening)}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="confirm-dialog admin-action-dialog">
          <DialogHeader>
            <p className="eyebrow">Decision oversight</p>
            <DialogTitle>Reopen this decision?</DialogTitle>
            <DialogDescription>
              {reopening && (
                <>
                  {reopening.submission.referenceNumber} ·{" "}
                  {reopening.submission.title}
                  <br />
                  Current decision:{" "}
                  <strong>{reopening.status.toLowerCase()}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <p className="admin-dialog-note">
            Reopening returns the submission to the coordinator&apos;s eligible
            review queue. The researcher and coordinator are notified, active
            assignments are closed, and this action is written to the audit log.
          </p>

          <label className="dialog-reason">
            Reason for reopening
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={20}
              maxLength={2000}
              required
              placeholder="Explain the evidence, appeal, or process concern that requires a new review round."
            />
          </label>

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
              disabled={busy || reason.trim().length < 20}
              onClick={() => void submit()}
            >
              {busy ? "Reopening…" : "Reopen decision"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
