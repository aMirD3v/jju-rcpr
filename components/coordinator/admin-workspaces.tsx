"use client";

import { useRouter } from "next/navigation";
import { CallForm } from "@/components/forms/call-form";

type Call = { id: string; title: string; description: string; topics: string[]; requirements: string; acceptedFileTypes: string[]; requiredDocuments: { id: string; label: string; description: string | null }[]; status: string; opensAt: string | Date; closesAt: string | Date; criteria: { label: string; description: string | null }[]; _count: { submissions: number } };

export function CoordinatorCallsWorkspace({ calls }: { calls: Call[] }) {
  const router = useRouter();
  function refresh() { router.refresh(); }
  return <main className="workspace-page">
    <div className="page-intro workspace-page-intro"><p className="eyebrow">Opportunity calendar</p><h1>Research calls</h1><p>Create and maintain the calls that invite guest researchers to submit work to Jigjiga University.</p></div>
    <section className="workspace-panel"><div className="workspace-panel-heading"><div><p className="eyebrow">Call register</p><h2>{calls.length} call(s)</h2></div><a href="#new-call" className="button button-primary">Create a call</a></div>
      <div className="call-admin-list">{calls.map((call) => <details key={call.id}><summary><strong>{call.title}</strong><span><span className={"status-pill status-" + call.status.toLowerCase()}>{call.status}</span> · {call._count.submissions} submissions · {new Date(call.opensAt).toLocaleDateString()} – {new Date(call.closesAt).toLocaleDateString()}</span></summary><CallForm initialCall={call} onCreated={refresh} /></details>)}{calls.length === 0 && <p className="empty-copy">No calls have been created. Use the form below to prepare the first one.</p>}</div>
    </section>
    <section className="workspace-panel" id="new-call"><p className="eyebrow">New opportunity</p><h2>Create a research call</h2><CallForm onCreated={refresh} /></section>
  </main>;
}
