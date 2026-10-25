"use client";

import { FormEvent, useState } from "react";

type RequiredDocument = { id: string; label: string; description?: string | null };

export function DocumentUpload({ submissionId, requirements, accept }: { submissionId: string; requirements: RequiredDocument[]; accept: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const uploads = requirements.map((requirement) => ({ requirementId: requirement.id, file: form.get(`requiredDocument_${requirement.id}`) }))
      .filter((item): item is { requirementId: string; file: File } => item.file instanceof File && item.file.size > 0);
    const extras = form.getAll("extraDocuments").filter((item): item is File => item instanceof File && item.size > 0).map((file) => ({ requirementId: null, file }));
    if (uploads.length !== requirements.length) { setMessage("Upload each required document before continuing."); setBusy(false); return; }
    let uploaded = 0;
    for (const item of [...uploads, ...extras]) {
      const payload = new FormData(); payload.set("file", item.file); if (item.requirementId) payload.set("requirementId", item.requirementId);
      const response = await fetch(`/api/submissions/${submissionId}/documents`, { method: "POST", body: payload });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Upload failed."); setBusy(false); return; }
      uploaded++;
    }
    setBusy(false); setMessage(`${uploaded} document(s) uploaded.`); event.currentTarget.reset();
  }
  return <form className="compact-form" onSubmit={submit}>
    {requirements.length > 0 && <fieldset className="required-document-fields"><legend>Required by this call</legend>{requirements.map((requirement) => <label key={requirement.id}>{requirement.label}{requirement.description && <small>{requirement.description}</small>}<input type="file" name={`requiredDocument_${requirement.id}`} accept={accept} required /></label>)}</fieldset>}
    <label>Add optional supporting documents<input type="file" name="extraDocuments" multiple accept={accept} /><small>Only file types permitted by the call are accepted. Maximum 20 MB per file.</small></label>
    {message && <p role="status">{message}</p>}
    <button className="button button-secondary" disabled={busy}>{busy ? "Uploading…" : "Upload documents"}</button>
  </form>;
}
