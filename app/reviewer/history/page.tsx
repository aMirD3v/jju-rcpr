import { AssignmentList } from "@/components/reviewer/assignment-list";
import { PageIntro } from "@/components/site/page-intro";

export const metadata = { title: "Review history" };
export default function ReviewerHistoryPage() {
  return <main className="workspace-page"><PageIntro eyebrow="University reviewer" title="Review history">View the recommendations and comments you submitted, plus assignments you declined or declared a conflict on.</PageIntro><AssignmentList view="history" /></main>;
}
