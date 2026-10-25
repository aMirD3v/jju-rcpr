import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { getActor } from "@/lib/auth";
import { WorkspaceSidebar } from "@/components/site/workspace-sidebar";

type WorkspaceRole = "ADMIN" | "COORDINATOR" | "REVIEWER" | "RESEARCHER";

export async function WorkspaceFrame({ role, children }: { role: WorkspaceRole; children: ReactNode }) {
  await connection();
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role !== role) redirect(actor.role === "ADMIN" ? "/admin" : actor.role === "COORDINATOR" ? "/coordinator" : actor.role === "REVIEWER" ? "/reviewer" : "/portal");
  return <div className="workspace-frame shell"><WorkspaceSidebar role={role} name={actor.name || actor.email || "JJU member"} /><div className="workspace-frame-content">{children}</div></div>;
}
