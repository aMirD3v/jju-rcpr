"use client";
import { FormEvent, useState } from "react";
export function ResendVerificationForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); const form = new FormData(event.currentTarget); const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email") }) }); const data = await response.json(); setBusy(false); setMessage(data.message ?? data.error ?? "Unable to request verification."); }
  return <form className="auth-form" onSubmit={submit}><label>Email address<input name="email" type="email" defaultValue={initialEmail} required /></label>{message && <p role="status">{message}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Sending…" : "Send verification link"}</button></form>;
}
