"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export function PasswordResetRequestForm() {
  const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const email = new FormData(event.currentTarget).get("email");
      const response = await fetch("/api/auth/password-reset/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "Unable to request a reset link."); else setMessage(data.message);
    } catch { setError("Unable to contact the account service. Please try again."); }
    finally { setBusy(false); }
  }
  return message ? <div className="success-receipt" role="status"><h2>Check your email</h2><p>{message}</p><Link href="/sign-in" className="text-link">Return to sign in</Link></div> : <form className="auth-form" onSubmit={submit}><label>Email address<input name="email" type="email" autoComplete="email" required /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Requesting link…" : "Send password reset link"}</button></form>;
}

export function PasswordResetConfirmForm({ token }: { token: string }) {
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const password = new FormData(event.currentTarget).get("password");
      const response = await fetch("/api/auth/password-reset/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "Unable to reset your password."); else setDone(true);
    } catch { setError("Unable to contact the account service. Please try again."); }
    finally { setBusy(false); }
  }
  if (done) return <div className="success-receipt" role="status"><h2>Password updated</h2><p>Your old sign-in sessions have been invalidated. Sign in with the new password.</p><Link href="/sign-in" className="button button-primary">Return to sign in</Link></div>;
  if (!token) return <div className="form-notice"><strong>Reset link missing</strong><p>Request a new password reset link to continue.</p><Link href="/forgot-password" className="text-link">Request a reset link</Link></div>;
  return <form className="auth-form" onSubmit={submit}><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} required /><small>At least 12 characters, including a letter and a number.</small></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Updating password…" : "Set new password"}</button></form>;
}
