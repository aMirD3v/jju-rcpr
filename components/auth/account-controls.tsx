"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { LogOut } from "lucide-react";

export function AccountControls({ href, label }: { href: string; label: string }) {
  return <div className="account-controls">
    <Link href={href} className="header-workspace-link"><span className="header-workspace-desktop">{label}</span><span className="header-workspace-mobile">Workspace</span><span aria-hidden="true">→</span></Link>
    <button type="button" className="nav-logout" aria-label="Sign out" title="Sign out" onClick={() => void signOut({ callbackUrl: "/" })}><LogOut size={17} aria-hidden="true" /><span>Sign out</span></button>
  </div>;
}
