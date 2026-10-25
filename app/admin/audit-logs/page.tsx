import { AuditLogBrowser } from "@/components/admin/audit-log-browser";
import { requireAdministrator } from "@/lib/admin-data";

export const metadata = { title: "Audit log" };
export default async function AdminAuditLogsPage() {
  await requireAdministrator();
  return <main className="workspace-page"><div className="page-intro workspace-page-intro"><p className="eyebrow">System accountability</p><h1>Audit log</h1><p>Read the recorded account and research workflow events. Audit records are immutable in this interface.</p></div><AuditLogBrowser /></main>;
}
