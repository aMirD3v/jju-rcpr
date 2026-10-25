"use client";

import { useEffect, useState } from "react";

type Entry = { id: string; action: string; resourceType: string; resourceId: string; detail: unknown; createdAt: string; actor: { id: string; name: string; email: string; role: string } | null };
export function AuditLogBrowser() {
  const [items, setItems] = useState<Entry[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [query, setQuery] = useState(""); const [action, setAction] = useState(""); const [resourceType, setResourceType] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ page: String(page), q: query, action, resourceType });
    fetch("/api/admin/audit-logs?" + params, { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!active) return;
      if (response.ok) { setItems(data.items); setTotal(data.total); setError(""); } else setError(data.error ?? "Unable to load the audit log.");
    }).catch(() => { if (active) setError("Unable to reach the audit service."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, action, resourceType]);
  const pages = Math.max(1, Math.ceil(total / 30));
  return <section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Immutable administrative record</p><h2>Audit events</h2></div><span>{total} result(s)</span></div><div className="workspace-toolbar audit-toolbar"><label>Search event, resource, or actor<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search the audit record" /></label><label>Action contains<input value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} placeholder="e.g. ACCOUNT_" /></label><label>Resource type<input value={resourceType} onChange={(event) => { setResourceType(event.target.value); setPage(1); }} placeholder="e.g. User" /></label></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="audit-list">{items.map((entry) => <article className="audit-entry" key={entry.id}><div className="audit-entry-heading"><div><strong>{entry.action.replaceAll("_", " ")}</strong><span>{entry.actor?.name ?? "System"} · {entry.actor?.email ?? "Automated event"} · {entry.actor?.role ?? "SYSTEM"}</span></div><time>{new Date(entry.createdAt).toLocaleString()}</time></div><p><span className="badge badge-slate">{entry.resourceType}</span> <code>{entry.resourceId}</code></p>{entry.detail != null && <details><summary>Event detail</summary><pre>{JSON.stringify(entry.detail, null, 2)}</pre></details>}</article>)}{!loading && items.length === 0 && <p className="empty-copy">No audit events match these filters.</p>}{loading && <p className="empty-copy" role="status">Loading audit events…</p>}</div>{total > 30 && <div className="pagination"><span>Page {page} of {pages}</span><button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button button-secondary" disabled={page >= pages || loading} onClick={() => setPage((value) => value + 1)}>Next</button></div>}</section>;
}
