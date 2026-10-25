"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export function RegisterForm() {
  const [error, setError] = useState(""); const [success, setSuccess] = useState(""); const [email, setEmail] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) { setBusy(false); setError(data.error ?? "Unable to register."); return; }
    setBusy(false); setEmail(String(payload.email)); setSuccess(data.message ?? "Check your email to activate the account.");
  }
  if (success) return <div className="success-receipt"><h2>Account created</h2><p>{success}</p><Link href={"/resend-verification?email=" + encodeURIComponent(email)} className="text-link">Request another verification link</Link><p><Link href="/sign-in" className="button button-primary">Continue to sign in</Link></p></div>;
  return <form className="auth-form" onSubmit={submit}><label>Full name<input name="name" autoComplete="name" required minLength={2} maxLength={120} /></label><label>Email address<input name="email" type="email" autoComplete="email" required /></label><label>Institution<input name="institution" autoComplete="organization" required /></label><label>Password<input name="password" type="password" autoComplete="new-password" minLength={12} required /><small>At least 12 characters, including a letter and a number.</small></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Creating account…" : "Create researcher account"}</button></form>;
}
