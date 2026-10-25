import { PageIntro } from "@/components/site/page-intro";
import { requireCoordinator } from "@/lib/coordinator-data";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reports and exports" };
export default async function CoordinatorReportsPage() {
  const actor = await requireCoordinator();
  const calls = await prisma.researchCall.findMany({ where: { coordinatorId: actor.id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } });
  return <main className="workspace-page"><PageIntro eyebrow="Research coordination" title="Reports and exports">Download a working CSV register for calls you coordinate. Review comments and researcher contact details are excluded.</PageIntro><section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">CSV export</p><h2>Build a report</h2></div></div><form action="/api/coordinator/reports" method="get" className="workflow-form"><label>Report<select name="kind" required defaultValue="submissions"><option value="submissions">Submission register</option><option value="reviews">Review workload and recommendations</option></select></label><label>Research call<select name="callId" defaultValue=""><option value="">All calls I coordinate</option>{calls.map((call) => <option value={call.id} key={call.id}>{call.title}</option>)}</select></label><div className="form-grid"><label>Created from<input type="date" name="from" /></label><label>Created through<input type="date" name="to" /></label></div><p className="muted-copy">Exports include at most 20,000 rows. Dates use UTC. Keep downloaded research records in approved university storage.</p><button className="button button-primary">Download CSV</button></form></section></main>;
}
