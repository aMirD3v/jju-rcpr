"use client";

import { FormEvent, useState } from "react";

type RequiredDocument = { id: string; label: string; description: string | null };
export function RevisionForm({ submissionId, round, requirements = [], accept = ".pdf,.doc,.docx" }: { submissionId: string; round: number; requirements?: RequiredDocument[]; accept?: string }) {
  const [error, setError] = useState(""); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); const form = new FormData(event.currentTarget);
    const required = requirements.map((item) => ({ requirementId: item.id, file: form.get(`requiredDocument_${item.id}`) })).filter((item): item is { requirementId: string; file: File } => item.file instanceof File && item.file.size > 0);
    if (required.length !== requirements.length) { setBusy(false); setError("Upload every document required by this call."); return; }
    const extras = form.getAll("documents").filter((item): item is File => item instanceof File && item.size > 0).map((file) => ({ requirementId: null, file }));
    const uploads = [...required, ...extras];
    if (uploads.length > 5 || uploads.some((item) => item.file.size > 20 * 1024 * 1024) || uploads.reduce((n, item) => n + item.file.size, 0) > 50 * 1024 * 1024) { setBusy(false); setError("Add no more than five documents, up to 20 MB each and 50 MB total."); return; }
    const response = await fetch("/api/submissions/" + submissionId + "/revisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), abstract: form.get("abstract"), requiredDocumentIds: requirements.map((item) => item.id) }) }); const data = await response.json();
    if (!response.ok) { setBusy(false); setError(data.error ?? "Unable to submit revision."); return; }
    for (const item of uploads) { const body = new FormData(); body.set("file", item.file); if (item.requirementId) body.set("requirementId", item.requirementId); const upload = await fetch("/api/submissions/" + submissionId + "/documents", { method: "POST", body }); if (!upload.ok) { const result = await upload.json(); setBusy(false); setError("Revision saved for Round " + round + ", but document upload failed: " + result.error); return; } }
    setBusy(false); setDone(true);
  }
  if (done) return <p role="status" className="form-message">Revision submitted and added to the version history.</p>;
  return <form className="workflow-form" onSubmit={submit}><label>Revised title<input name="title" minLength={8} required /></label><label>Revised abstract<textarea name="abstract" rows={6} minLength={80} required /></label>{requirements.length > 0 && <fieldset className="required-document-fields"><legend>Required by this call</legend>{requirements.map((item) => <label key={item.id}>{item.label}{item.description && <small>{item.description}</small>}<input name={`requiredDocument_${item.id}`} type="file" accept={accept} required /></label>)}</fieldset>}<label>Additional supporting documents<input name="documents" type="file" multiple accept={accept} /></label>{error && <p role="alert" className="form-error">{error}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Submitting revision…" : "Submit revised version"}</button></form>;
}
