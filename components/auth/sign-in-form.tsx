"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";

export function SignInForm({ callbackUrl = "" }: { callbackUrl?: string }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const result = await signIn("credentials", { email: form.get("email"), password: form.get("password"), redirect: false });
      if (result?.error) {
        setError("Email and password did not match an active, verified account.");
      } else {
        const session = await getSession();
        const user = session?.user as { role?: string; passwordResetRequired?: boolean } | undefined;
        let safeCallback = "";
        try {
          const target = new URL(callbackUrl, window.location.origin);
          if (callbackUrl.startsWith("/") && target.origin === window.location.origin) {
            safeCallback = target.pathname + target.search + target.hash;
          }
        } catch {
          safeCallback = "";
        }
        const destination = user?.passwordResetRequired
          ? "/change-password"
          : safeCallback || (user?.role === "ADMIN"
            ? "/admin"
            : user?.role === "COORDINATOR"
              ? "/coordinator"
              : user?.role === "REVIEWER"
                ? "/reviewer"
                : "/portal");
        // A full navigation refreshes the authenticated root layout, header, and footer.
        window.location.assign(destination);
      }
    } catch { setError("Unable to contact the sign-in service. Please try again."); }
    finally { setBusy(false); }
  }
  return <form className="auth-form" onSubmit={submit}><label>Email address<input autoComplete="email" name="email" type="email" required /></label><label>Password<input autoComplete="current-password" name="password" type="password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button></form>;
}
