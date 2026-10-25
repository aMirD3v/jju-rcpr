import { AccountManager } from "@/components/admin/account-manager";
import { requireAdministrator } from "@/lib/admin-data";

export const metadata = { title: "Account management" };
export default async function AdminAccountsPage() {
  await requireAdministrator();
  return <main className="workspace-page"><div className="page-intro workspace-page-intro"><p className="eyebrow">System administration</p><h1>Account management</h1><p>Create internal staff accounts, verify guest researcher identities, revoke access, and issue audited password resets.</p></div><AccountManager /></main>;
}
