"use client";

import { FormEvent, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type CallRecord = { id: string; title: string; description: string; topics: string[]; requirements: string; acceptedFileTypes: string[]; opensAt: string | Date; closesAt: string | Date; status: string; criteria: { label: string; description?: string | null }[] };
const formats = [
  ["application/pdf", "PDF"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word (.docx)"],
  ["application/msword", "Word (.doc)"],
] as const;

function localDateTime(value?: string | Date) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function CallForm({ onCreated, initialCall }: { onCreated: () => void; initialCall?: CallRecord }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [confirming, setConfirming] = useState(false); const [confirmingStatus, setConfirmingStatus] = useState(""); const [confirmed, setConfirmed] = useState(false); const formRef = useRef<HTMLFormElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    const nextStatus = String(form.get("status") ?? "");
    if (initialCall && ["CLOSED", "ARCHIVED"].includes(nextStatus) && nextStatus !== initialCall.status && !confirmed) { setConfirmingStatus(nextStatus); setConfirming(true); return; }
    if (confirmed) setConfirmed(false);
    setBusy(true); setMessage("");
    const payload = {
      title: form.get("title"), description: form.get("description"), topics: String(form.get("topics")).split("\n").map((x) => x.trim()).filter(Boolean),
      requirements: form.get("requirements"), acceptedFileTypes: form.getAll("acceptedFileTypes").filter((value): value is string => typeof value === "string"),
      opensAt: new Date(String(form.get("opensAt"))).toISOString(), closesAt: new Date(String(form.get("closesAt"))).toISOString(),
      status: initialCall ? form.get("status") : form.get("publish") === "on" ? "OPEN" : "DRAFT",
      criteria: String(form.get("criteria")).split("\n").map((label) => ({ label: label.trim() })).filter((item) => item.label),
    };
    const response = await fetch(initialCall ? `/api/coordinator/calls/${initialCall.id}` : "/api/coordinator/calls", { method: initialCall ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json(); setBusy(false); if (!response.ok) { setMessage(data.error ?? "Unable to save this call."); return; }
    setMessage(initialCall ? "Call changes saved." : "Call saved."); if (!initialCall) formElement.reset(); onCreated();
  }
  return <form ref={formRef} className="workflow-form" onSubmit={submit}>
    <div className="form-grid"><label>Call title<input name="title" minLength={8} maxLength={240} required defaultValue={initialCall?.title} /></label><label>Topics <small>One topic per line</small><textarea name="topics" rows={3} required defaultValue={initialCall?.topics.join("\n")} /></label></div>
    <label>Call description<textarea name="description" rows={4} required minLength={20} defaultValue={initialCall?.description} /></label>
    <label>Submission requirements<textarea name="requirements" rows={4} required minLength={10} defaultValue={initialCall?.requirements} /></label>
    <label>Review criteria <small>One criterion per line</small><textarea name="criteria" rows={3} defaultValue={initialCall?.criteria.map((criterion) => criterion.label).join("\n")} /></label>
    <fieldset className="format-options"><legend>Accepted document formats</legend>{formats.map(([value, label]) => <label key={value}><input type="checkbox" name="acceptedFileTypes" value={value} defaultChecked={initialCall ? initialCall.acceptedFileTypes.includes(value) : value !== "application/msword"} />{label}</label>)}</fieldset>
    <div className="form-grid"><label>Opens<input name="opensAt" type="datetime-local" required defaultValue={localDateTime(initialCall?.opensAt)} /></label><label>Closes<input name="closesAt" type="datetime-local" required defaultValue={localDateTime(initialCall?.closesAt)} /></label></div>
    {initialCall ? <label>Call state<select name="status" defaultValue={initialCall.status}><option value="DRAFT">Draft</option><option value="OPEN">Published / open</option><option value="CLOSED">Closed</option><option value="ARCHIVED">Archived</option></select></label> : <label className="check-label"><input type="checkbox" name="publish" /> Publish immediately when the window is open</label>}
    {message && <p role="status" className="form-message">{message}</p>}<button className="button button-primary" disabled={busy}>{busy ? "Saving…" : initialCall ? "Save call changes" : "Save research call"}</button>
    <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent className="confirm-dialog"><DialogHeader><p className="eyebrow">Call status change</p><DialogTitle>{confirmingStatus === "ARCHIVED" ? "Archive this research call?" : "Close this research call?"}</DialogTitle><DialogDescription>{confirmingStatus === "ARCHIVED" ? "The call will be removed from active call management. Its submissions and history will remain available to the coordinator." : "The call will stop accepting new submissions. Existing submission records and review work will remain available."}</DialogDescription></DialogHeader><DialogFooter><button type="button" className="button button-ghost" onClick={() => setConfirming(false)}>Cancel</button><button type="button" className="button button-primary" onClick={() => { setConfirmed(true); setConfirming(false); setTimeout(() => formRef.current?.requestSubmit(), 0); }}>Confirm status change</button></DialogFooter></DialogContent></Dialog>
  </form>;
}
