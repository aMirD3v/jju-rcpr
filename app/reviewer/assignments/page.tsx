import { AssignmentList } from "@/components/reviewer/assignment-list";
import { PageIntro } from "@/components/site/page-intro";

export const metadata = { title: "Review assignments" };
export default function ReviewerAssignmentsPage() {
  return <main className="workspace-page"><PageIntro eyebrow="University reviewer" title="Review assignments">Accept assigned work or declare a conflict. Accepted assignments contain the structured review form.</PageIntro><AssignmentList view="active" /></main>;
}
