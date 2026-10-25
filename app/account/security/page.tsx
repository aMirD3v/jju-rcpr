import { redirect } from "next/navigation";
import { MfaManager } from "@/components/auth/mfa-manager";
import { PageIntro } from "@/components/site/page-intro";
import { WorkspaceFrame } from "@/components/site/workspace-frame";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Account security" };
// This authenticated page depends on the request session and private account data.
export const instant = false;
export default async function AccountSecurityPage() {
  const actor = await getActor(); if (!actor) redirect("/sign-in");
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { mfaEnabled: true } });
  return <WorkspaceFrame role={actor.role}><main className="workspace-page"><PageIntro eyebrow="Personal settings" title="Account security">Protect your JJU-RCPR account with an authenticator app and recovery codes.</PageIntro><MfaManager initiallyEnabled={Boolean(user?.mfaEnabled)} /></main></WorkspaceFrame>;
}
