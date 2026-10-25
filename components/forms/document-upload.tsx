"use client";
import { FormEvent, useState } from "react";
export function DocumentUpload({ submissionId }: { submissionId: string }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(event.currentTarget); const files = form.getAll("files").filter((item): item is File => item instanceof File && item.size > 0); for (const file of files) { const payload = new FormData(); payload.set("file", file); const response = await fetch("/api/submissions/" + submissionId + "/documents", { method: "POST", body: payload }); const data = await response.json(); if (!response.ok) { setMessage(data.error ?? "Upload failed."); setBusy(false); return; } } setMessage(files.length + " document(s) uploaded."); setBusy(false); event.currentTarget.reset(); }
  return <form className="compact-form" onSubmit={submit}><label>Add supporting documents<input type="file" name="files" multiple accept=".pdf,.doc,.docx" required /><small>Only file types permitted by the call are accepted. Maximum 20 MB per file.</small></label>{message && <p role="status">{message}</p>}<button className="button button-secondary" disabled={busy}>{busy ? "Uploading…" : "Upload documents"}</button></form>;
}
