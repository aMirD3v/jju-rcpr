"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type QueueMode = "all" | "screening" | "assignments" | "decisions";
type Reviewer = { id: string; name: string; institution: string | null };
type Submission = {
  id: string; referenceNumber: string; title: string; topic: string; status: string;
  researcher: { name: string; email: string }; call: { title: string };
  assignments: { id: string; reviewerId: string; reviewer: { name: string }; status: string; dueAt: string | Date; review: { submittedAt: string | Date | null } | null }[];
};

function WorkItem({ mode, item, reviewers, refresh }: { mode: QueueMode; item: Submission; reviewers: Reviewer[]; refresh: () => void }) {
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<{ url: string; payload: object; title: string; detail: string } | null>(null);
  const root = "/api/coordinator/submissions/" + item.id;
  const reviewsComplete = item.assignments.length > 0 && item.assignments.every((assignment) => assignment.status === "COMPLETED" && assignment.review?.submittedAt);

  async function post(url: string, payload: object) {
    setMessage("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error ?? "Action could not be completed."); return; }
      setMessage("Workflow updated.");
      refresh();
    } catch { setMessage("Unable to contact the workflow service."); }
  }

  return <article className="work-item">
    <div className="work-item-head"><div><p className="eyebrow">{item.referenceNumber} · {item.call.title}</p><h3>{item.title}</h3><p>{item.researcher.name} · {item.topic}</p></div><span className={"status-pill status-" + item.status.toLowerCase()}>{item.status.replaceAll("_", " ")}</span></div>
    {mode === "screening" && <div className="action-row"><label>Screening note<textarea id={"screen-note-" + item.id} placeholder="Record eligibility assessment or required correction" /></label><div className="action-buttons"><button type="button" className="button button-secondary" onClick={() => void post(root + "/screen", { outcome: "ELIGIBLE_FOR_REVIEW", note: (document.getElementById("screen-note-" + item.id) as HTMLTextAreaElement).value })}>Mark eligible</button><button type="button" className="button button-secondary" onClick={() => void post(root + "/screen", { outcome: "RETURNED_FOR_CORRECTION", note: (document.getElementById("screen-note-" + item.id) as HTMLTextAreaElement).value })}>Return for correction</button><button type="button" className="button button-danger" onClick={() => setConfirmation({ title: "Decline at screening?", detail: "This will record a screening decline and notify the researcher.", url: root + "/screen", payload: { outcome: "SCREENING_DECLINED", note: (document.getElementById("screen-note-" + item.id) as HTMLTextAreaElement).value } })}>Decline at screening</button></div></div>}
    {mode === "assignments" && <div className="action-row assignment-row"><label>Assign reviewer<select id={"reviewer-" + item.id} defaultValue=""><option value="" disabled>Select reviewer</option>{reviewers.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.name}{reviewer.institution ? " · " + reviewer.institution : ""}</option>)}</select></label><label>Replace active assignment<select id={"replace-" + item.id} defaultValue=""><option value="">Create an additional assignment</option>{item.assignments.filter((assignment) => assignment.status !== "COMPLETED").map((assignment) => <option key={assignment.id} value={assignment.id}>{assignment.reviewer.name} · {assignment.status.replaceAll("_", " ")}</option>)}</select></label><label>Review deadline<input id={"due-" + item.id} type="datetime-local" required /></label><label>Reassignment reason<textarea id={"reassignment-reason-" + item.id} placeholder="Required when replacing an active reviewer" /></label><button type="button" className="button button-secondary" disabled={reviewers.length === 0} onClick={() => { const due = (document.getElementById("due-" + item.id) as HTMLInputElement).value; const replaceAssignmentId = (document.getElementById("replace-" + item.id) as HTMLSelectElement).value; if (!due) { setMessage("Set a review deadline first."); return; } void post(root + "/assignments", { reviewerId: (document.getElementById("reviewer-" + item.id) as HTMLSelectElement).value, dueAt: new Date(due).toISOString(), ...(replaceAssignmentId ? { replaceAssignmentId, reassignmentReason: (document.getElementById("reassignment-reason-" + item.id) as HTMLTextAreaElement).value } : {}) }); }}>Assign reviewer</button><span>{item.assignments.length} active assignment(s) · {item.assignments.filter((assignment) => assignment.status === "COMPLETED" && assignment.review?.submittedAt).length} reviews submitted</span></div>}
    {mode === "decisions" && <div className="action-row"><label>Decision feedback<textarea id={"decision-note-" + item.id} placeholder="Provide a reasoned decision and author-facing feedback" /></label><div className="decision-actions"><select id={"decision-outcome-" + item.id} defaultValue="REVISION_REQUESTED" aria-label="Decision"><option value="ACCEPTED">Accept</option><option value="REVISION_REQUESTED">Request revisions</option><option value="REJECTED">Reject</option></select>{!reviewsComplete && <><label className="check-label"><input id={"override-" + item.id} type="checkbox" /> Record an authorized review override</label><label>Override reason<textarea id={"override-reason-" + item.id} minLength={20} placeholder="Required when reviews remain outstanding" /></label></>}<button type="button" className="button button-primary" onClick={() => { const outcome = (document.getElementById("decision-outcome-" + item.id) as HTMLSelectElement).value; const overrideOutstandingReviews = !reviewsComplete && (document.getElementById("override-" + item.id) as HTMLInputElement).checked; const overrideReason = overrideOutstandingReviews ? (document.getElementById("override-reason-" + item.id) as HTMLTextAreaElement).value : undefined; setConfirmation({ title: "Record this final decision?", detail: overrideOutstandingReviews ? "This bypasses outstanding reviews. The reason will be permanently audited and sent with the decision." : "The decision and feedback will be added to the submission history and sent to the researcher.", url: root + "/decision", payload: { outcome, feedback: (document.getElementById("decision-note-" + item.id) as HTMLTextAreaElement).value, overrideOutstandingReviews, ...(overrideReason ? { overrideReason } : {}) } }); }}>Review and record decision</button></div></div>}
    <Dialog open={Boolean(confirmation)} onOpenChange={(open) => { if (!open) setConfirmation(null); }}><DialogContent className="confirm-dialog"><DialogHeader><p className="eyebrow">Coordinator confirmation</p><DialogTitle>{confirmation?.title}</DialogTitle><DialogDescription>{confirmation?.detail}</DialogDescription></DialogHeader><DialogFooter><button type="button" className="button button-ghost" onClick={() => setConfirmation(null)}>Cancel</button><button type="button" className="button button-primary" onClick={() => { if (!confirmation) return; const pending = confirmation; setConfirmation(null); void post(pending.url, pending.payload); }}>Confirm decision</button></DialogFooter></DialogContent></Dialog>
    {message && <p className="form-message" role="status">{message}</p>}<a href={"/coordinator/submissions/" + item.id} className="text-link">Open submission record →</a>
  </article>;
}

const modeConfig: Record<QueueMode, { title: string; intro: string; statuses: string[] }> = {
  all: { title: "All submissions", intro: "Search the complete submission register and open the full record for any submission.", statuses: ["SUBMITTED", "RETURNED_FOR_CORRECTION", "SCREENING_DECLINED", "ELIGIBLE_FOR_REVIEW", "UNDER_REVIEW", "REVISION_REQUESTED", "ACCEPTED", "REJECTED"] },
  screening: { title: "Screening queue", intro: "Check submission completeness and eligibility before any reviewer is assigned.", statuses: ["SUBMITTED"] },
  assignments: { title: "Reviewer assignments", intro: "Assign eligible submissions, set deadlines, and monitor active review progress.", statuses: ["ELIGIBLE_FOR_REVIEW", "UNDER_REVIEW"] },
  decisions: { title: "Final decisions", intro: "Review recommendations and record the coordinator’s final, reasoned decision.", statuses: ["UNDER_REVIEW"] },
};

export function CoordinatorSubmissionQueue({ mode, submissions: initialSubmissions, reviewers }: { mode: QueueMode; submissions: Submission[]; reviewers: Reviewer[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initialSubmissions);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const config = modeConfig[mode];
  async function refresh() {
    router.refresh();
    try {
      const response = await fetch("/api/coordinator/submissions", { cache: "no-store" });
      if (response.ok) {
        const allRows = await response.json() as Submission[];
        setRows(allRows.filter((row) => config.statuses.includes(row.status)));
      }
    } catch { /* The route refresh remains available if background refresh fails. */ }
  }
  const filtered = useMemo(() => rows.filter((item) => (!status || item.status === status) && `${item.referenceNumber} ${item.title} ${item.researcher.name} ${item.researcher.email} ${item.call.title} ${item.topic}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [rows, status, query]);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  return <main className="workspace-page">
    <div className="page-intro workspace-page-intro"><p className="eyebrow">Research coordination</p><h1>{config.title}</h1><p>{config.intro}</p></div>
    <div className="workspace-toolbar"><label>Search records<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Reference, title, researcher, or call" /></label><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{config.statuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><span>{filtered.length} record(s)</span></div>
    <div className="work-queue">{visible.map((item) => <WorkItem key={item.id} mode={mode} item={item} reviewers={reviewers} refresh={() => void refresh()} />)}{filtered.length === 0 && <div className="card empty-state"><h2>{rows.length ? "No records match these filters" : "Nothing is waiting here"}</h2><p>{mode === "screening" ? "New submissions that need an eligibility check will appear in this queue." : mode === "assignments" ? "Eligible submissions awaiting assignment or active reviews will appear here." : "Submissions with completed reviews will appear here for a final decision."}</p></div>}</div>
    {filtered.length > pageSize && <div className="pagination"><span>Page {page} of {pageCount}</span><button className="button button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button className="button button-secondary" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </main>;
}
