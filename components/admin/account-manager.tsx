"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Clock,
  KeyRound,
  Settings2,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Account = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "COORDINATOR" | "REVIEWER" | "RESEARCHER";
  institution: string | null;
  reviewerExpertise?: string[];
  maxActiveAssignments?: number | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
};
type Action = "VERIFY_RESEARCHER" | "ACTIVATE" | "DEACTIVATE" | "RESET_PASSWORD";
type StaffRole = "ADMIN" | "COORDINATOR" | "REVIEWER";

const roleNames: Record<Account["role"], string> = {
  ADMIN: "Administrator",
  COORDINATOR: "Research coordinator",
  REVIEWER: "University reviewer",
  RESEARCHER: "Guest researcher",
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function AccountManager() {
  const router = useRouter();
  const [items, setItems] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dialog, setDialog] = useState<{ account: Account; action: Action } | null>(null);
  const [managing, setManaging] = useState<Account | null>(null);
  const [manageError, setManageError] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [temporary, setTemporary] = useState<{ email: string; password: string } | null>(null);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createRole, setCreateRole] = useState<StaffRole>("COORDINATOR");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        q: query,
        ...(role ? { role } : {}),
      });
      const response = await fetch("/api/admin/accounts?" + params, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Could not load accounts.");
        return;
      }
      setError("");
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Could not reach the account service.");
    } finally {
      setLoading(false);
    }
  }, [page, query, role]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({
      page: String(page),
      q: query,
      ...(role ? { role } : {}),
    });
    void fetch("/api/admin/accounts?" + params, { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (cancelled) return;
        if (!response.ok) {
          setError(data.error ?? "Could not load accounts.");
          return;
        }
        setError("");
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) setError("Could not reach the account service.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, query, role]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setCreateError("");
    setNotice("");
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setCreateError(data.error ?? "Could not create this account.");
        return;
      }
      setTemporary({
        email: data.account.email,
        password: data.temporaryPassword,
      });
      form.reset();
      setCreateRole("COORDINATOR");
      setNotice("Account created. Record the temporary password now.");
      await load();
      router.refresh();
    } catch {
      setCreateError("Could not reach the account service.");
    } finally {
      setCreating(false);
    }
  }

  async function confirmAction() {
    if (!dialog) return;
    setBusy(true);
    setError("");
    setNotice("");
    const endpoint =
      dialog.action === "RESET_PASSWORD"
        ? `/api/admin/accounts/${dialog.account.id}/reset-password`
        : `/api/admin/accounts/${dialog.account.id}`;
    const method = dialog.action === "RESET_PASSWORD" ? "POST" : "PATCH";
    const body =
      dialog.action === "RESET_PASSWORD"
        ? { reason }
        : dialog.action === "DEACTIVATE"
          ? { action: dialog.action, reason }
          : { action: dialog.action };
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "The account action could not be completed.");
        return;
      }
      if (dialog.action === "RESET_PASSWORD") {
        setTemporary({
          email: dialog.account.email,
          password: data.temporaryPassword,
        });
      }
      setNotice(
        dialog.action === "VERIFY_RESEARCHER"
          ? "Researcher identity verified."
          : dialog.action === "RESET_PASSWORD"
            ? "Password reset. Record the temporary password now."
            : `Account ${dialog.action === "ACTIVATE" ? "activated" : "deactivated"}.`,
      );
      setDialog(null);
      setReason("");
      await load();
      router.refresh();
    } catch {
      setError("Could not reach the account service.");
    } finally {
      setBusy(false);
    }
  }

  function manageAccount(account: Account) {
    setManageError("");
    setManaging(account);
  }

  function startAction(account: Account, action: Action) {
    setManaging(null);
    setManageError("");
    setError("");
    setDialog({ account, action });
    setReason("");
  }

  async function saveReviewerProfile(account: Account, form: HTMLFormElement) {
    const values = new FormData(form);
    setManageError("");
    setNotice("");
    const expertise = String(values.get("expertise") ?? "")
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    const rawCapacity = String(values.get("capacity") ?? "").trim();
    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_REVIEWER_PROFILE",
          reviewerExpertise: expertise,
          maxActiveAssignments: rawCapacity ? Number(rawCapacity) : null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setManageError(data.error ?? "Could not update reviewer profile.");
        return;
      }
      setNotice(`Reviewer profile updated for ${account.name}.`);
      setManaging(null);
      await load();
      router.refresh();
    } catch {
      setManageError("Could not reach the account service.");
    }
  }

  function clearFilters() {
    setLoading(true);
    setQuery("");
    setRole("");
    setPage(1);
  }

  const pages = Math.max(1, Math.ceil(total / 20));
  const dialogCopy: Record<Action, [string, string]> = {
    VERIFY_RESEARCHER: [
      "Verify researcher account",
      "Confirm that the research office completed the required identity check.",
    ],
    ACTIVATE: ["Activate this account", "The user will be able to sign in again."],
    DEACTIVATE: [
      "Deactivate this account",
      "This immediately revokes active sessions. Record the administrative reason.",
    ],
    RESET_PASSWORD: [
      "Issue a temporary password",
      "The current password will be revoked. The new password is shown once and must be changed at next sign-in.",
    ],
  };

  return (
    <div className="admin-account-layout">
      <section className="workspace-panel admin-directory-panel">
        <div className="workspace-panel-heading">
          <div>
            <p className="eyebrow">Directory</p>
            <h2>Accounts</h2>
          </div>
          <span>
            {loading && items.length === 0 ? "—" : `${total} total`}
          </span>
        </div>

        <div className="workspace-toolbar admin-account-toolbar">
          <label>
            Search by name, email, or institution
            <input
              type="search"
              value={query}
              onChange={(event) => {
                setLoading(true);
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search accounts"
            />
          </label>
          <label>
            Role
            <select
              value={role}
              onChange={(event) => {
                setLoading(true);
                setRole(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All roles</option>
              {Object.entries(roleNames).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-results-line">
          <span aria-live="polite">
            {loading
              ? "Loading directory…"
              : `${total} account${total === 1 ? "" : "s"}${
                  query || role ? " matching filters" : ""
                }`}
          </span>
          {(query || role) && (
            <button
              type="button"
              className="admin-clear-filters"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="form-message" role="status">
            {notice}
          </p>
        )}

        <div className="account-list" aria-busy={loading}>
          {items.map((account) => (
            <article className="account-row" key={account.id}>
              <div className="account-row-main">
                <span className="account-avatar" aria-hidden="true">
                  {initials(account.name)}
                </span>
                <div className="account-identity">
                  <strong>{account.name}</strong>
                  <span>{account.email}</span>
                  <small>
                    {account.institution || "Institution not recorded"}
                    <span className="account-created">
                      {" · Added "}
                      {new Date(account.createdAt).toLocaleDateString()}
                    </span>
                  </small>
                </div>
                <div className="account-access">
                  <span className="badge badge-slate">
                    {roleNames[account.role]}
                  </span>
                  <span className="account-flags">
                    <span
                      className={
                        "account-flag " +
                        (account.isActive ? "is-active" : "is-inactive")
                      }
                    >
                      <span className="account-flag-dot" aria-hidden="true" />
                      {account.isActive ? "Active" : "Inactive"}
                    </span>
                    <span
                      className={
                        "account-flag " +
                        (account.emailVerifiedAt
                          ? "is-verified"
                          : "is-pending")
                      }
                    >
                      {account.emailVerifiedAt ? (
                        <BadgeCheck size={13} aria-hidden="true" />
                      ) : (
                        <Clock size={13} aria-hidden="true" />
                      )}
                      {account.emailVerifiedAt
                        ? "Verified"
                        : "Verification pending"}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="button button-secondary account-manage-button"
                  onClick={() => manageAccount(account)}
                >
                  <Settings2 size={14} aria-hidden="true" />
                  Manage
                </button>
              </div>
            </article>
          ))}

          {!loading && items.length === 0 && (
            <div className="admin-empty">
              <strong>No accounts match this search</strong>
              <span>Try a different name, email, institution, or role.</span>
            </div>
          )}
        </div>

        {total > 20 && (
          <div className="pagination">
            <span>
              Page {page} of {pages} · {total} accounts
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

      <aside className="workspace-panel admin-create-panel">
        <div className="workspace-panel-heading">
          <div>
            <p className="eyebrow">Create internal account</p>
            <h2>Provision staff access</h2>
          </div>
        </div>
        <form
          className="admin-create-form"
          onSubmit={(event) => void create(event)}
        >
          <label>
            Full name
            <input
              name="name"
              required
              minLength={2}
              maxLength={120}
              autoComplete="name"
            />
          </label>
          <label>
            Institution
            <input
              name="institution"
              required
              minLength={2}
              maxLength={180}
              autoComplete="organization"
            />
          </label>
          <label>
            Email address
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
            />
          </label>
          <label>
            Account role
            <select
              name="role"
              value={createRole}
              onChange={(event) =>
                setCreateRole(event.target.value as StaffRole)
              }
            >
              <option value="ADMIN">Administrator</option>
              <option value="COORDINATOR">Research coordinator</option>
              <option value="REVIEWER">University reviewer</option>
            </select>
          </label>
          {createRole === "REVIEWER" && (
            <>
              <label>
                Reviewer expertise
                <input
                  name="reviewerExpertise"
                  placeholder="Epidemiology, public health"
                />
                <span>Optional. Separate topics with commas.</span>
              </label>
              <label>
                Maximum active reviews
                <input
                  name="maxActiveAssignments"
                  type="number"
                  min="1"
                  max="100"
                  placeholder="No limit"
                />
              </label>
            </>
          )}
          {createError && (
            <p role="alert" className="form-error">
              {createError}
            </p>
          )}
          <button
            className="button button-primary admin-form-submit"
            disabled={creating}
          >
            {creating ? "Creating account…" : "Create staff account"}
          </button>
          <p className="admin-form-note">
            Staff accounts are issued a one-time password and must change it at
            first sign-in.
          </p>
        </form>

        {temporary && (
          <div className="temporary-password" role="status">
            <strong>Temporary password for {temporary.email}</strong>
            <code>{temporary.password}</code>
            <p>
              Shown once. Share through an approved secure university channel;
              the user must change it at first sign-in.
            </p>
            <div className="action-buttons">
              <button
                className="button button-secondary"
                onClick={() =>
                  void navigator.clipboard?.writeText(temporary.password)
                }
              >
                Copy password
              </button>
              <button
                className="button button-ghost"
                onClick={() => setTemporary(null)}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </aside>

      <Dialog
        open={Boolean(managing)}
        onOpenChange={(open) => {
          if (!open) {
            setManaging(null);
            setManageError("");
          }
        }}
      >
        <DialogContent className="account-manage-dialog">
          <DialogHeader>
            <p className="eyebrow">Account management</p>
            <DialogTitle>
              {managing ? managing.name : "Manage account"}
            </DialogTitle>
            <DialogDescription>
              {managing && (
                <>
                  {managing.email} · {roleNames[managing.role]}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {managing && (
            <>
              <div className="account-manage-summary">
                <span
                  className={
                    "account-flag " +
                    (managing.isActive ? "is-active" : "is-inactive")
                  }
                >
                  <span className="account-flag-dot" aria-hidden="true" />
                  {managing.isActive ? "Active" : "Inactive"}
                </span>
                <span
                  className={
                    "account-flag " +
                    (managing.emailVerifiedAt ? "is-verified" : "is-pending")
                  }
                >
                  {managing.emailVerifiedAt ? (
                    <BadgeCheck size={13} aria-hidden="true" />
                  ) : (
                    <Clock size={13} aria-hidden="true" />
                  )}
                  {managing.emailVerifiedAt
                    ? "Verified"
                    : "Verification pending"}
                </span>
                <span>
                  Added {new Date(managing.createdAt).toLocaleDateString()}
                </span>
              </div>

              {managing.role === "REVIEWER" && (
                <form
                  className="reviewer-profile-form account-manage-reviewer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveReviewerProfile(managing, event.currentTarget);
                  }}
                >
                  <p className="account-manage-section-title">Reviewer profile</p>
                  <label>
                    Expertise
                    <input
                      name="expertise"
                      defaultValue={managing.reviewerExpertise?.join(", ") ?? ""}
                      placeholder="Epidemiology, public health"
                    />
                  </label>
                  <label>
                    Maximum active reviews
                    <input
                      name="capacity"
                      type="number"
                      min="1"
                      max="100"
                      defaultValue={managing.maxActiveAssignments ?? ""}
                      placeholder="No limit"
                    />
                  </label>
                  <button className="button button-secondary">
                    Save reviewer profile
                  </button>
                </form>
              )}

              <div className="account-manage-section">
                <p className="account-manage-section-title">
                  Access and security
                </p>
                <div className="account-action-list">
                  {managing.role === "RESEARCHER" &&
                    !managing.emailVerifiedAt && (
                      <button
                        type="button"
                        className="account-action"
                        onClick={() =>
                          startAction(managing, "VERIFY_RESEARCHER")
                        }
                      >
                        <BadgeCheck size={18} aria-hidden="true" />
                        <span>
                          <strong>Verify identity</strong>
                          <small>
                            Confirm the research office completed the required
                            identity check.
                          </small>
                        </span>
                      </button>
                    )}
                  {managing.isActive && managing.emailVerifiedAt && (
                    <button
                      type="button"
                      className="account-action"
                      onClick={() => startAction(managing, "RESET_PASSWORD")}
                    >
                      <KeyRound size={18} aria-hidden="true" />
                      <span>
                        <strong>Issue temporary password</strong>
                        <small>
                          Revoke the current password and issue a one-time
                          password for the next sign-in.
                        </small>
                      </span>
                    </button>
                  )}
                  {managing.isActive ? (
                    <button
                      type="button"
                      className="account-action account-action-danger"
                      onClick={() => startAction(managing, "DEACTIVATE")}
                    >
                      <UserX size={18} aria-hidden="true" />
                      <span>
                        <strong>Deactivate account</strong>
                        <small>
                          Immediately revoke access and all active sessions.
                        </small>
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="account-action"
                      onClick={() => startAction(managing, "ACTIVATE")}
                    >
                      <UserCheck size={18} aria-hidden="true" />
                      <span>
                        <strong>Reactivate account</strong>
                        <small>Allow this user to sign in again.</small>
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {manageError && (
                <p className="form-error" role="alert">
                  {manageError}
                </p>
              )}
            </>
          )}

          <DialogFooter>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setManaging(null);
                setManageError("");
              }}
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(dialog)}
        onOpenChange={(open) => {
          if (!open) {
            setDialog(null);
            setReason("");
          }
        }}
      >
        <DialogContent className="confirm-dialog">
          <DialogHeader>
            <p className="eyebrow">Account administration</p>
            <DialogTitle>
              {dialog ? dialogCopy[dialog.action][0] : "Confirm account action"}
            </DialogTitle>
            <DialogDescription>
              {dialog && (
                <>
                  {dialogCopy[dialog.action][1]}
                  <br />
                  <strong>
                    {dialog.account.name} · {dialog.account.email}
                  </strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {(dialog?.action === "DEACTIVATE" ||
            dialog?.action === "RESET_PASSWORD") && (
            <label className="dialog-reason">
              Administrative reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                minLength={10}
                maxLength={1000}
                required
                placeholder="Record why this action is required."
              />
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <DialogFooter>
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                setDialog(null);
                setReason("");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="button button-primary"
              disabled={
                busy ||
                ((dialog?.action === "DEACTIVATE" ||
                  dialog?.action === "RESET_PASSWORD") &&
                  reason.trim().length < 10)
              }
              onClick={() => void confirmAction()}
            >
              {busy ? "Saving…" : "Confirm action"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
