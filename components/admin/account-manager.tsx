"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Account = { id: string; name: string; email: string; role: "ADMIN" | "COORDINATOR" | "REVIEWER" | "RESEARCHER"; institution: string | null; isActive: boolean; emailVerifiedAt: string | null; createdAt: string };
type Action = "VERIFY_RESEARCHER" | "ACTIVATE" | "DEACTIVATE" | "RESET_PASSWORD";
const roleNames: Record<Account["role"], string> = { ADMIN: "Administrator", COORDINATOR: "Research coordinator", REVIEWER: "University reviewer", RESEARCHER: "Guest researcher" };

export function AccountManager() {
  const router = useRouter();
  const [items, setItems] = useState<Account[]>([]); const [total, setTotal] = useState(0); const [page, setPage] = useState(1); const [query, setQuery] = useState(""); const [role, setRole] = useState(""); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<{ account: Account; action: Action } | null>(null); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false); const [temporary, setTemporary] = useState<{ email: string; password: string } | null>(null);
  const [createError, setCreateError] = useState(""); const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), q: query, ...(role ? { role } : {}) });
      const response = await fetch("/api/admin/accounts?" + params, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "Could not load accounts."); return; }
      setError("");
      setItems(data.items); setTotal(data.total);
    } catch { setError("Could not reach the account service."); }
    finally { setLoading(false); }
  }, [page, query, role]);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), q: query, ...(role ? { role } : {}) });
    void fetch("/api/admin/accounts?" + params, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok) { setError(data.error ?? "Could not load accounts."); return; }
        setError(""); setItems(data.items); setTotal(data.total);
      })
      .catch(() => { if (!cancelled) setError("Could not reach the account service."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, query, role]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCreating(true); setCreateError(""); setNotice("");
    const form = event.currentTarget; const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/admin/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { setCreateError(data.error ?? "Could not create this account."); return; }
      setTemporary({ email: data.account.email, password: data.temporaryPassword }); form.reset(); setNotice("Account created. Record the temporary password now."); await load(); router.refresh();
    } catch { setCreateError("Could not reach the account service."); }
    finally { setCreating(false); }
  }

  async function confirmAction() {
    if (!dialog) return;
    setBusy(true); setError(""); setNotice("");
    const endpoint = dialog.action === "RESET_PASSWORD" ? `/api/admin/accounts/${dialog.account.id}/reset-password` : `/api/admin/accounts/${dialog.account.id}`;
    const method = dialog.action === "RESET_PASSWORD" ? "POST" : "PATCH";
    const body = dialog.action === "RESET_PASSWORD" ? { reason } : dialog.action === "DEACTIVATE" ? { action: dialog.action, reason } : { action: dialog.action };
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "The account action could not be completed."); return; }
      if (dialog.action === "RESET_PASSWORD") setTemporary({ email: dialog.account.email, password: data.temporaryPassword });
      setNotice(dialog.action === "VERIFY_RESEARCHER" ? "Researcher identity verified." : dialog.action === "RESET_PASSWORD" ? "Password reset. Record the temporary password now." : `Account ${dialog.action === "ACTIVATE" ? "activated" : "deactivated"}.`);
      setDialog(null); setReason(""); await load(); router.refresh();
    } catch { setError("Could not reach the account service."); }
    finally { setBusy(false); }
  }

  const pages = Math.max(1, Math.ceil(total / 20));
  const dialogCopy: Record<Action, [string, string]> = {
    VERIFY_RESEARCHER: ["Verify researcher account", "Confirm that the research office completed the required identity check."],
    ACTIVATE: ["Activate this account", "The user will be able to sign in again."],
    DEACTIVATE: ["Deactivate this account", "This immediately revokes active sessions. Record the administrative reason."],
    RESET_PASSWORD: ["Issue a temporary password", "The current password will be revoked. The new password is shown once and must be changed at next sign-in."],
  };
  return <div className="admin-account-layout">
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Create internal account</p><h2>Provision staff access</h2></div></div><form className="admin-create-form" onSubmit={(event) => void create(event)}><label>Full name<input name="name" required minLength={2} maxLength={120} /></label><label>Institution<input name="institution" required minLength={2} maxLength={180} /></label><label>Email address<input name="email" type="email" required maxLength={254} /></label><label>Account role<select name="role" defaultValue="COORDINATOR"><option value="ADMIN">Administrator</option><option value="COORDINATOR">Research coordinator</option><option value="REVIEWER">University reviewer</option></select></label>{createError && <p role="alert" className="form-error">{createError}</p>}<button className="button button-primary" disabled={creating}>{creating ? "Creating account…" : "Create staff account"}</button></form>
      {temporary && <div className="temporary-password" role="status"><strong>Temporary password for {temporary.email}</strong><code>{temporary.password}</code><p>Shown once. Share through an approved secure university channel; the user must change it at first sign-in.</p><div className="action-buttons"><button className="button button-secondary" onClick={() => void navigator.clipboard?.writeText(temporary.password)}>Copy password</button><button className="button button-ghost" onClick={() => setTemporary(null)}>Dismiss</button></div></div>}
    </section>
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Directory</p><h2>Accounts</h2></div><span>{total} total</span></div><div className="workspace-toolbar account-toolbar"><label>Search by name, email, or institution<input type="search" value={query} onChange={(event) => { setLoading(true); setQuery(event.target.value); setPage(1); }} placeholder="Search accounts" /></label><label>Role<select value={role} onChange={(event) => { setLoading(true); setRole(event.target.value); setPage(1); }}><option value="">All roles</option>{Object.entries(roleNames).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-message" role="status">{notice}</p>}
      <div className="account-list">{items.map((account) => <article className="account-row" key={account.id}><div className="account-row-main"><div><strong>{account.name}</strong><span>{account.email} · {account.institution || "Institution not recorded"}</span><small>Created {new Date(account.createdAt).toLocaleDateString()}</small></div><div className="account-state"><span className="badge badge-slate">{roleNames[account.role]}</span><span className={"badge " + (account.isActive ? "badge-green" : "badge-red")}>{account.isActive ? "Active" : "Inactive"}</span><span className={"badge " + (account.emailVerifiedAt ? "badge-green" : "badge-amber")}>{account.emailVerifiedAt ? "Verified" : "Pending verification"}</span></div></div><div className="account-row-actions">{account.role === "RESEARCHER" && !account.emailVerifiedAt && <button className="button button-secondary" onClick={() => { setDialog({ account, action: "VERIFY_RESEARCHER" }); setReason(""); }}>Verify identity</button>}{account.isActive ? <button className="button button-ghost" onClick={() => { setDialog({ account, action: "DEACTIVATE" }); setReason(""); }}>Deactivate</button> : <button className="button button-secondary" onClick={() => { setDialog({ account, action: "ACTIVATE" }); setReason(""); }}>Activate</button>}{account.isActive && account.emailVerifiedAt && <button className="button button-secondary" onClick={() => { setDialog({ account, action: "RESET_PASSWORD" }); setReason(""); }}>Reset password</button>}</div></article>)}{!loading && items.length === 0 && <p className="empty-copy">No accounts match this search.</p>}{loading && <p className="empty-copy" role="status">Loading accounts…</p>}</div>
      {total > 20 && <div className="pagination"><span>Page {page} of {pages}</span><button className="button button-secondary" disabled={page <= 1 || loading} onClick={() => { setLoading(true); setPage((value) => value - 1); }}>Previous</button><button className="button button-secondary" disabled={page >= pages || loading} onClick={() => { setLoading(true); setPage((value) => value + 1); }}>Next</button></div>}
    </section>
    <Dialog open={Boolean(dialog)} onOpenChange={(open) => { if (!open) { setDialog(null); setReason(""); } }}><DialogContent className="confirm-dialog"><DialogHeader><p className="eyebrow">Account administration</p><DialogTitle>{dialog ? dialogCopy[dialog.action][0] : "Confirm account action"}</DialogTitle><DialogDescription>{dialog && <>{dialogCopy[dialog.action][1]}<br /><strong>{dialog.account.name} · {dialog.account.email}</strong></>}</DialogDescription></DialogHeader>{(dialog?.action === "DEACTIVATE" || dialog?.action === "RESET_PASSWORD") && <label className="dialog-reason">Administrative reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} maxLength={1000} required placeholder="Record why this action is required." /></label>}<DialogFooter><button type="button" className="button button-ghost" onClick={() => { setDialog(null); setReason(""); }}>Cancel</button><button type="button" className="button button-primary" disabled={busy || ((dialog?.action === "DEACTIVATE" || dialog?.action === "RESET_PASSWORD") && reason.trim().length < 10)} onClick={() => void confirmAction()}>{busy ? "Saving…" : "Confirm action"}</button></DialogFooter></DialogContent></Dialog>
  </div>;
}
