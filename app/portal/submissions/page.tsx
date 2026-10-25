import Link from "next/link";
import { redirect } from "next/navigation";
import { PageIntro } from "@/components/site/page-intro";
import { SubmissionCards } from "@/components/researcher/submission-cards";
import { getActor } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "My submissions" };
export default async function ResearcherSubmissionsPage() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.role === "ADMIN") redirect("/admin");
  if (actor.role === "COORDINATOR") redirect("/coordinator");
  if (actor.role === "REVIEWER") redirect("/reviewer");
  const submissions = await prisma.researchSubmission.findMany({ where: { researcherId: actor.id }, include: { call: { select: { title: true } }, decisions: { orderBy: { createdAt: "desc" }, take: 1 } }, orderBy: { updatedAt: "desc" } });
  return <main className="workspace-page"><PageIntro eyebrow="Private researcher area" title="My submissions">Your references, current statuses, most recent decisions, and revision history.</PageIntro><div className="portal-topline"><Link href="/" className="button button-secondary">Browse calls</Link><Link href="/submit" className="button button-primary">New submission</Link></div><SubmissionCards submissions={submissions} /></main>;
}
