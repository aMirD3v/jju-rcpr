import { redirect } from "next/navigation";
import { PageIntro } from "@/components/site/page-intro";
import { SubmissionForm } from "@/components/forms/submission-form";
import { WorkspaceFrame } from "@/components/site/workspace-frame";
import { getActor } from "@/lib/auth";
export const metadata = { title: "Submit research" };
export default async function SubmitPage({ searchParams }: { searchParams: Promise<{ call?: string | string[] }> }) {
  const query = await searchParams;
  const initialCallId = typeof query.call === "string" ? query.call : "";
  const actor = await getActor();
  if (!actor) redirect("/sign-in?callbackUrl=" + encodeURIComponent("/submit" + (initialCallId ? "?call=" + encodeURIComponent(initialCallId) : "")));
  if (actor.role !== "RESEARCHER") redirect(actor.role === "ADMIN" ? "/admin" : actor.role === "COORDINATOR" ? "/coordinator" : "/reviewer");
  return <WorkspaceFrame role="RESEARCHER"><main className="workspace-page"><PageIntro eyebrow="Researcher submission" title="Submit to an open call">Your submission is private to you and the university staff assigned to the review process. The call requirements govern each submission.</PageIntro><section className="form-shell"><SubmissionForm authorName={actor.name ?? ""} email={actor.email ?? ""} institution={actor.institution ?? ""} initialCallId={initialCallId} /></section></main></WorkspaceFrame>;
}
