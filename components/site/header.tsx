import Link from "next/link";
import type { SessionActor } from "@/lib/auth";
import { AccountControls } from "@/components/auth/account-controls";
import { NotificationBell } from "@/components/site/notification-bell";

export function Header({ actor }: { actor: SessionActor | null }) {
  const dashboard = actor?.passwordResetRequired
    ? ["Change password", "/change-password"]
    : actor?.role === "ADMIN"
      ? ["Administration", "/admin"]
      : actor?.role === "COORDINATOR"
        ? ["Coordinator workspace", "/coordinator"]
        : actor?.role === "REVIEWER"
          ? ["Reviewer workspace", "/reviewer"]
          : actor
            ? ["Researcher portal", "/portal"]
            : null;

  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <Link href="/" className="brand" aria-label="JJU Research Call and Peer Review home">
          <span className="brand-mark" aria-hidden="true">JJU</span>
          <span className="brand-name"><strong className="brand-name-full">Jigjiga University</strong><strong className="brand-name-compact">JJU-RCPR</strong><small>Research Call &amp; Peer Review</small></span>
        </Link>
        {actor ? (
          <div className="header-actions">
            {!actor.passwordResetRequired && <NotificationBell />}
            <AccountControls href={dashboard?.[1] ?? "/"} label={dashboard?.[0] ?? "Workspace"} />
          </div>
        ) : (
          <div className="header-actions">
            <Link href="/sign-in" className="header-signin">Sign in</Link>
            <Link href="/register" className="button button-primary header-register">Create account</Link>
          </div>
        )}
      </div>
    </header>
  );
}
