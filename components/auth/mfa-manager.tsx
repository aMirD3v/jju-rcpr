"use client";
import { QRCodeSVG } from "qrcode.react";
import { FormEvent, useState } from "react";

type Setup = { secret: string; otpauthUrl: string; recoveryCodes: string[] };

export function MfaManager({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error);
        return;
      }
      setSetup(data);
    } catch {
      setMessage("Unable to start MFA setup.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/mfa/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: form.get("code") }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error);
        return;
      }
      setEnabled(true);
      setSetup(null);
      setMessage("Multi-factor authentication is enabled.");
    } catch {
      setMessage("Unable to confirm MFA setup.");
    } finally {
      setBusy(false);
    }
  }

  async function disable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.get("password"), code: form.get("code") }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error);
        return;
      }
      setEnabled(false);
      setMessage("MFA disabled. Sign in again to refresh your session.");
    } catch {
      setMessage("Unable to change account security settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-panel">
      <div className="workspace-panel-heading">
        <div>
          <p className="eyebrow">Account security</p>
          <h2>Multi-factor authentication</h2>
        </div>
        <span className={"badge " + (enabled ? "badge-green" : "badge-slate")}>
          {enabled ? "Enabled" : "Not enabled"}
        </span>
      </div>
      <p>Use an authenticator app with time-based one-time codes. Recovery codes are shown once when you enable MFA.</p>
      {message && <p role="status" className="form-message">{message}</p>}

      {!enabled && !setup && (
        <button className="button button-primary" disabled={busy} onClick={() => void start()}>
          {busy ? "Preparing…" : "Set up authenticator"}
        </button>
      )}

      {setup && (
        <>
          <div className="mfa-setup">
            <div className="mfa-qr">
              <QRCodeSVG
                value={setup.otpauthUrl}
                size={192}
                level="M"
                marginSize={2}
                title="QR code for authenticator app setup"
              />
            </div>
            <div className="mfa-setup-copy">
              <h3>Scan with your authenticator app</h3>
              <p>Open your authenticator app and scan the QR code. If you cannot scan it, enter the setup key manually.</p>
              <label>
                Manual setup key
                <input readOnly value={setup.secret} onFocus={(event) => event.currentTarget.select()} />
              </label>
            </div>
          </div>
          <div className="recovery-codes">
            <h3>Recovery codes — save these securely now</h3>
            <pre>{setup.recoveryCodes.join("\n")}</pre>
          </div>
          <form className="auth-form" onSubmit={(event) => void confirm(event)}>
            <label>
              Authenticator code
              <input name="code" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" />
            </label>
            <button className="button button-primary" disabled={busy}>
              {busy ? "Verifying…" : "Confirm and enable MFA"}
            </button>
          </form>
        </>
      )}

      {enabled && (
        <form className="auth-form" onSubmit={(event) => void disable(event)}>
          <p>Disabling MFA requires your password and an authenticator or unused recovery code. This revokes existing sessions.</p>
          <label>
            Current password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <label>
            Authenticator or recovery code
            <input name="code" autoComplete="one-time-code" required />
          </label>
          <button className="button button-secondary" disabled={busy}>
            {busy ? "Updating…" : "Disable MFA"}
          </button>
        </form>
      )}
    </section>
  );
}
