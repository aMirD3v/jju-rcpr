"use client";
import { useState } from "react";
import Link from "next/link";
export function VerifyEmailForm({ token }: { token: string }) {
  const [message, setMessage] = useState(""); const [verified, setVerified] = useState(false); const [busy, setBusy] = useState(false);
  async function verify() { setBusy(true); const response = await fetch("/api/auth/verify-email", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) }); const data = await response.json(); setBusy(false); if (!response.ok) { setMessage(data.error ?? "Could not verify email."); return; } setVerified(true); }
  return <div className="form-shell auth-shell"><p>{verified ? "Your email address is verified. You can now sign in." : "Confirm that you control the email address used to register."}</p>{message && <p role="alert" className="form-error">{message}</p>}{verified ? <Link href="/sign-in" className="button button-primary">Continue to sign in</Link> : <button onClick={() => void verify()} className="button button-primary" disabled={busy || token.length < 32}>{busy ? "Verifying…" : "Verify email address"}</button>}</div>;
}
