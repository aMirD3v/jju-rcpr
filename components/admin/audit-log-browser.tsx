"use client";

import { useEffect, useState } from "react";

type Entry = {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  detail: unknown;
  createdAt: string;
  actor: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
};

function actionTone(action: string) {
  if (/DEACTIV|REVOK|DELETE|DECLIN|REJECT/.test(action)) return "is-danger";
  if (/CREATE|REGISTER|VERIFY|ACTIVATE|ACCEPT/.test(action)) return "is-success";
  if (/RESET|UPDATE|REVISION|RETURN|REOPEN|EXTEND|REMIND|REASSIGN/.test(action)) return "is-warning";
  return "";
}

export function AuditLogBrowser() {
  const [items, setItems] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({
      page: String(page),
      q: query,
      action,
      resourceType,
    });
    fetch("/api/admin/audit-logs?" + params, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!active) return;
        if (response.ok) {
          setItems(data.items);
          setTotal(data.total);
          setError("");
        } else {
          setError(data.error ?? "Unable to load the audit log.");
        }
      })
      .catch(() => {
        if (active) setError("Unable to reach the audit service.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, query, action, resourceType]);

  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading admin-audit-heading">
        <div>
          <p className="eyebrow">Immutable administrative record</p>
          <h2>Audit events</h2>
        </div>
        <span>{loading && items.length === 0 ? "—" : `${total} total`}</span>
      </div>

      <div className="workspace-toolbar audit-toolbar">
        <label>
          Search event, resource, or actor
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search the audit record"
          />
        </label>
        <label>
          Action contains
          <input
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            placeholder="e.g. ACCOUNT_"
          />
        </label>
        <label>
          Resource type
          <input
            value={resourceType}
            onChange={(event) => {
              setResourceType(event.target.value);
              setPage(1);
            }}
            placeholder="e.g. User"
          />
        </label>
      </div>

      <div className="admin-results-line">
        <span aria-live="polite">
          {loading
            ? "Loading audit events…"
            : `${total} event${total === 1 ? "" : "s"} recorded`}
        </span>
      </div>

      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}

      <div className="audit-list" aria-busy={loading}>
        {items.map((entry) => (
          <article className="audit-entry" key={entry.id}>
            <div className="audit-entry-heading">
              <div>
                <strong>
                  <span
                    className={`admin-event-dot ${actionTone(entry.action)}`}
                    aria-hidden="true"
                  />
                  {entry.action.replaceAll("_", " ")}
                </strong>
                <span>
                  {entry.actor?.name ?? "System"} ·{" "}
                  {entry.actor?.email ?? "Automated event"} ·{" "}
                  {entry.actor?.role ?? "SYSTEM"}
                </span>
              </div>
              <time dateTime={entry.createdAt}>
                {new Date(entry.createdAt).toLocaleString()}
              </time>
            </div>
            <p className="audit-entry-meta">
              <span className="badge badge-slate">{entry.resourceType}</span>
              <code>{entry.resourceId}</code>
            </p>
            {entry.detail != null && (
              <details>
                <summary>Event detail</summary>
                <pre>{JSON.stringify(entry.detail, null, 2)}</pre>
              </details>
            )}
          </article>
        ))}
        {!loading && items.length === 0 && (
          <div className="admin-empty">
            <strong>No audit events match these filters</strong>
            <span>Adjust the search terms or clear the action and resource filters.</span>
          </div>
        )}
      </div>

      {total > 30 && (
        <div className="pagination">
          <span>
            Page {page} of {pages} · {total} events
          </span>
          <button
            className="button button-secondary"
            disabled={page <= 1 || loading}
            onClick={() => {
              setLoading(true);
              setPage((value) => value - 1);
            }}
          >
            Previous
          </button>
          <button
            className="button button-secondary"
            disabled={page >= pages || loading}
            onClick={() => {
              setLoading(true);
              setPage((value) => value + 1);
            }}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
