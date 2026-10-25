"use client";
import { FormEvent, useState } from "react";
import { signOut } from "next-auth/react";
export function ChangePasswordForm() {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = Object.fromEntries(new FormData(event.currentTarget).entries()); const response = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); const data = await response.json(); setBusy(false); if (!response.ok) { setError(data.error ?? "Unable to change password."); return; } await signOut({ callbackUrl: "/sign-in?changed=1" }); }
  return <form className="auth-form" onSubmit={submit}><label>Temporary password<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} required /><small>At least 12 characters, including a letter and a number.</small></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Updating…" : "Set new password"}</button></form>;
}
