"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookOpen, ClipboardCheck, FileText, History, LayoutDashboard, ListChecks, Menu, ShieldCheck, Users, X } from "lucide-react";

type WorkspaceRole = "ADMIN" | "COORDINATOR" | "REVIEWER" | "RESEARCHER";
const coordinatorLinks = [
  { href: "/coordinator", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/coordinator/calls", label: "Research calls", icon: BookOpen },
  { href: "/coordinator/submissions", label: "All submissions", icon: FileText },
  { href: "/coordinator/screening", label: "Screening", icon: ClipboardCheck },
  { href: "/coordinator/assignments", label: "Reviewer assignments", icon: ListChecks },
  { href: "/coordinator/decisions", label: "Final decisions", icon: FileText },
];
const roleLabels: Record<WorkspaceRole, string> = { ADMIN: "System administration", COORDINATOR: "Research coordinator", REVIEWER: "University reviewer", RESEARCHER: "Guest researcher" };

export function WorkspaceSidebar({ role, name }: { role: WorkspaceRole; name: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = role === "ADMIN" ? [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/admin/accounts", label: "Accounts", icon: Users },
    { href: "/admin/audit-logs", label: "Audit log", icon: ShieldCheck },
  ] : role === "COORDINATOR" ? coordinatorLinks : role === "REVIEWER" ? [
    { href: "/reviewer", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/reviewer/assignments", label: "Review assignments", icon: ClipboardCheck },
    { href: "/reviewer/history", label: "Review history", icon: History },
    { href: "/", label: "Research calls", icon: BookOpen },
  ] : [
    { href: "/portal", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/portal/submissions", label: "My submissions", icon: FileText },
    { href: "/submit", label: "New submission", icon: ClipboardCheck },
    { href: "/", label: "Browse calls", icon: BookOpen },
  ];

  return <aside className="workspace-sidebar">
    <div className="workspace-sidebar-head">
      <div><span className="workspace-sidebar-kicker">Workspace</span><strong>{roleLabels[role]}</strong></div>
      <button className="workspace-menu-toggle" type="button" aria-label={open ? "Close workspace navigation" : "Open workspace navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
    </div>
    <nav className={"workspace-nav" + (open ? " workspace-nav-open" : "")} aria-label="Workspace navigation">
      <p className="workspace-nav-label">Manage</p>
      {links.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
        return <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={"workspace-nav-link" + (active ? " active" : "")}><Icon size={17} strokeWidth={1.8} /><span>{label}</span></Link>;
      })}
    </nav>
    <div className="workspace-sidebar-user"><span className="workspace-avatar">{name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "JJ"}</span><span><strong>{name}</strong><small>{roleLabels[role]}</small></span></div>
  </aside>;
}
