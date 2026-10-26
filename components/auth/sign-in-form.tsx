"use client";

import { FormEvent, useState } from "react";
import { getSession, signIn } from "next-auth/react";

type Credentials = { email: string; password: string };

export function SignInForm({
  callbackUrl = "",
  ssoEnabled = false,
}: {
  callbackUrl?: string;
  ssoEnabled?: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [credentials, setCredentials] = useState<Credentials | null>(null);

  async function finish(account: Credentials, totpCode?: string) {
    const result = await signIn("credentials", {
      email: account.email,
      password: account.password,
      totpCode,
      redirect: false,
    });
    if (result?.error) {
      setError(
        totpCode
          ? "The authenticator or recovery code was not accepted. Try again or use an unused recovery code."
          : "Email and password did not match an active, verified account.",
      );
      return;
    }
    const session = await getSession();
    const user = session?.user as
      | { role?: string; passwordResetRequired?: boolean }
      | undefined;
    let safeCallback = "";
    try {
      const target = new URL(callbackUrl, window.location.origin);
      if (
        callbackUrl.startsWith("/") &&
        target.origin === window.location.origin
      ) {
        safeCallback = target.pathname + target.search + target.hash;
      }
    } catch {
      safeCallback = "";
    }
    const destination = user?.passwordResetRequired
      ? "/change-password"
      : safeCallback ||
        (user?.role === "ADMIN"
          ? "/admin"
          : user?.role === "COORDINATOR"
            ? "/coordinator"
            : user?.role === "REVIEWER"
              ? "/reviewer"
              : "/portal");
    window.location.assign(destination);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (step === "mfa") {
        if (!credentials) {
          setStep("credentials");
          setError("Enter your email and password again.");
          return;
        }
        const code = String(form.get("totpCode") ?? "").trim();
        if (!code) {
          setError("Enter your authenticator or recovery code.");
          return;
        }
        await finish(credentials, code);
        return;
      }
      const email = String(form.get("email") ?? "");
      const password = String(form.get("password") ?? "");
      const response = await fetch("/api/auth/sign-in-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(
          data.error ??
            "Email and password did not match an active, verified account.",
        );
        return;
      }
      const account = { email, password };
      if (data.mfaRequired) {
        setCredentials(account);
        setStep("mfa");
        return;
      }
      await finish(account);
    } catch {
      setError("Unable to contact the sign-in service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {step === "mfa" ? (
        <form className="auth-form" onSubmit={submit}>
          <div className="form-notice">
            <strong>Two-step verification</strong>
            <span>
              MFA is enabled for {credentials?.email}. Enter the code from your
              authenticator app or one of your recovery codes.
            </span>
          </div>
          <label>
            Authenticator or recovery code{" "}
            <span className="muted-copy">
              Required only when MFA is enabled
            </span>
            <input
              autoComplete="one-time-code"
              name="totpCode"
              inputMode="numeric"
              autoFocus
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy}>
            {busy ? "Verifying…" : "Verify and sign in"}
          </button>
          <button
            className="button button-ghost"
            type="button"
            disabled={busy}
            onClick={() => {
              setStep("credentials");
              setCredentials(null);
              setError("");
            }}
          >
            Use a different account
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label>
            Email address
            <input autoComplete="email" name="email" type="email" required />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              required
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-primary" disabled={busy}>
            {busy ? "Checking…" : "Continue"}
          </button>
        </form>
      )}
      {ssoEnabled && step === "credentials" && (
        <div className="sso-signin">
          <span>or</span>
          <button
            className="button button-secondary"
            type="button"
            onClick={() =>
              void signIn("institutional", {
                callbackUrl: callbackUrl || undefined,
              })
            }
          >
            Sign in with{" "}
            {process.env.NEXT_PUBLIC_SSO_PROVIDER_NAME ||
              "university account"}
          </button>
        </div>
      )}
    </>
  );
}
