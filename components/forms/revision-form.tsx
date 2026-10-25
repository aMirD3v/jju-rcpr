"use client";

import { FormEvent, useState } from "react";

export function RevisionForm({ submissionId, round }: { submissionId: string; round: number }) {
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget); const files = form.getAll("documents").filter((item): item is File => item instanceof File && item.size > 0);
    const response = await fetch("/api/submissions/" + submissionId + "/revisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), abstract: form.get("abstract") }) }); const data = await response.json();
    if (!response.ok) { setBusy(false); setError(data.error ?? "Unable to submit revision."); return; }
    for (const file of files) { const body = new FormData(); body.set("file", file); const upload = await fetch("/api/submissions/" + submissionId + "/documents", { method: "POST", body }); if (!upload.ok) { const result = await upload.json(); setBusy(false); setError("Revision saved for Round " + round + ", but document upload failed: " + result.error); return; } }
    setBusy(false); setDone(true);
  }
  if (done) return <p role="status" className="form-message">Revision submitted and added to the version history.</p>;
  return <form className="workflow-form" onSubmit={submit}><label>Revised title<input name="title" minLength={8} required /></label><label>Revised abstract<textarea name="abstract" rows={6} minLength={80} required /></label><label>Updated documents<input name="documents" type="file" multiple accept=".pdf,.doc,.docx" /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Submitting revision…" : "Submit revised version"}</button></form>;
}
