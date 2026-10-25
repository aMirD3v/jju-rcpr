"use client";

import { FormEvent, useEffect, useState } from "react";

type Assignment = { id: string; dueAt: string; status: string; acceptedAt: string | null; submission: { id: string; referenceNumber: string; title: string; abstract: string; topic: string; currentRound: number; call: { title: string; criteria: { id: string; label: string; description: string | null }[] }; versions: { documents: { id: string; originalName: string; byteSize: number }[] }[] }; review: { submittedAt: string | null; recommendation: string; originality: number; relevance: number; researchQuality: number; methodology: number; clarity: number; authorComments: string; confidentialComments: string | null } | null };
const scores = [["originality", "Originality"], ["relevance", "Relevance"], ["researchQuality", "Research quality"], ["methodology", "Methodology"], ["clarity", "Clarity"]] as const;

export function AssignmentList({ view }: { view: "active" | "history" }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [query, setQuery] = useState(""); const [status, setStatus] = useState(""); const [page, setPage] = useState(1);
  async function refresh() {
    const response = await fetch("/api/reviewer/assignments", { cache: "no-store" });
    const data = await response.json();
    if (response.ok) setAssignments(data); else setError(data.error ?? "Unable to load assignments.");
  }
  useEffect(() => {
    let active = true;
    fetch("/api/reviewer/assignments", { cache: "no-store" }).then(async (response) => {
      const data = await response.json();
      if (!active) return;
      if (response.ok) setAssignments(data); else setError(data.error ?? "Unable to load assignments.");
    }).catch(() => { if (active) setError("Unable to load assignments."); });
    return () => { active = false; };
  }, []);
  async function action(id: string, payload: object, method = "PATCH") {
    setBusyId(id); setError("");
    const response = await fetch("/api/reviewer/assignments/" + id, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json(); setBusyId("");
    if (!response.ok) setError(data.error ?? "Unable to save review."); else await refresh();
  }
  function sendReview(form: HTMLFormElement, id: string, submit: boolean) {
    const values = Object.fromEntries(new FormData(form).entries());
    const scoreValues = Object.fromEntries(scores.map(([key]) => [key, Number(values[key])]));
    void action(id, { ...scoreValues, authorComments: values.authorComments, confidentialComments: values.confidentialComments, recommendation: values.recommendation, submit }, "PUT");
  }
  function handleSubmit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    sendReview(event.currentTarget, id, true);
  }
  const viewAssignments = assignments.filter((assignment) => view === "active" ? ["PENDING", "ACCEPTED"].includes(assignment.status) : ["COMPLETED", "DECLINED", "CONFLICT_DECLARED"].includes(assignment.status));
  const filtered = viewAssignments.filter((assignment) => (!status || assignment.status === status) && `${assignment.submission.referenceNumber} ${assignment.submission.title} ${assignment.submission.topic} ${assignment.submission.call.title}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const pageSize = 10; const pages = Math.max(1, Math.ceil(filtered.length / pageSize)); const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  return <div className="assignment-list">
    {error && <p role="alert" className="form-error">{error}</p>}
    {viewAssignments.length > 0 && <div className="workflow-filters"><label>Search assignments<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Reference, title, topic, or call" /></label><label>Assignment status<select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All {view === "active" ? "active assignments" : "history"}</option>{(view === "active" ? ["PENDING", "ACCEPTED"] : ["COMPLETED", "DECLINED", "CONFLICT_DECLARED"]).map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label></div>}
    {visible.map((assignment) => <article className="assignment-card" key={assignment.id}>
      <div className="submission-card-head"><div><p className="eyebrow">{assignment.submission.referenceNumber} · Round {assignment.submission.currentRound} · {assignment.submission.call.title}</p><h2>{assignment.submission.title}</h2><p>{assignment.submission.topic}</p></div><span className={"status-pill status-" + assignment.status.toLowerCase()}>{assignment.status.replaceAll("_", " ")}</span></div>
      <details className="review-content"><summary>Read submission and documents</summary><p>{assignment.submission.abstract}</p>{assignment.submission.versions.flatMap((version) => version.documents).map((file) => <p key={file.id}><a className="text-link" href={"/api/documents/" + file.id}>{file.originalName} · {(file.byteSize / 1024 / 1024).toFixed(1)} MB ↗</a></p>)}<h3>Call criteria</h3><ul>{assignment.submission.call.criteria.map((criterion) => <li key={criterion.id}>{criterion.label}{criterion.description ? ": " + criterion.description : ""}</li>)}</ul></details>
      {view === "active" && assignment.status === "PENDING" && <div className="assignment-response"><button type="button" className="button button-primary" disabled={busyId === assignment.id} onClick={() => void action(assignment.id, { action: "ACCEPT" })}>Accept assignment</button><form onSubmit={(event) => { event.preventDefault(); const note = new FormData(event.currentTarget).get("conflictNote"); void action(assignment.id, { action: "CONFLICT", conflictNote: note }); }}><label>Conflict of interest<textarea name="conflictNote" minLength={10} required placeholder="Explain any relationship or conflict relevant to this submission." /></label><button className="button button-secondary" disabled={busyId === assignment.id}>Declare conflict</button></form></div>}
      {view === "active" && assignment.status === "ACCEPTED" && !assignment.review?.submittedAt && <form className="review-form" onSubmit={(event) => handleSubmit(event, assignment.id)}><h3>Structured assessment</h3><div className="score-grid">{scores.map(([key, label]) => <label key={key}>{label}<select name={key} defaultValue={String(assignment.review?.[key] ?? 3)} required><option value="1">1 · Weak</option><option value="2">2 · Below standard</option><option value="3">3 · Adequate</option><option value="4">4 · Strong</option><option value="5">5 · Excellent</option></select></label>)}</div><label>Recommendation<select name="recommendation" defaultValue={assignment.review?.recommendation ?? "ACCEPT"}><option value="ACCEPT">Accept</option><option value="MINOR_REVISION">Minor revisions</option><option value="MAJOR_REVISION">Major revisions</option><option value="REJECT">Reject</option></select></label><label>Comments for the author<textarea name="authorComments" minLength={40} rows={5} required placeholder="Offer specific, constructive feedback that can be shared with the author." defaultValue={assignment.review?.authorComments ?? ""} /></label><label>Confidential comments for coordinator<textarea name="confidentialComments" rows={4} placeholder="This field is visible to the coordinator only." defaultValue={assignment.review?.confidentialComments ?? ""} /></label><div className="action-buttons"><button type="button" className="button button-secondary" disabled={busyId === assignment.id} onClick={(event) => { const form = event.currentTarget.form; if (form) sendReview(form, assignment.id, false); }}>Save review draft</button><button type="submit" className="button button-primary" disabled={busyId === assignment.id}>Submit review</button></div></form>}
      {view === "history" && assignment.review?.submittedAt && <div className="review-report"><p><strong>Submitted review · {new Date(assignment.review.submittedAt).toLocaleDateString()}</strong></p><p><strong>Recommendation:</strong> {assignment.review.recommendation.replaceAll("_", " ")}</p><p><strong>Scores:</strong> Originality {assignment.review.originality}/5 · Relevance {assignment.review.relevance}/5 · Quality {assignment.review.researchQuality}/5 · Methodology {assignment.review.methodology}/5 · Clarity {assignment.review.clarity}/5</p><p><strong>Comments for author</strong></p><p>{assignment.review.authorComments}</p>{assignment.review.confidentialComments && <><p><strong>Confidential comments to coordinator</strong></p><p>{assignment.review.confidentialComments}</p></>}</div>}
      {assignment.review?.submittedAt && <div className="form-message">Review submitted {new Date(assignment.review.submittedAt).toLocaleDateString()} · Recommendation: {assignment.review.recommendation?.replaceAll("_", " ")}</div>}
      <p className="due-note">Review deadline: {new Date(assignment.dueAt).toLocaleDateString()}</p>
    </article>)}
    {viewAssignments.length === 0 && <div className="empty-state"><p className="eyebrow">{view === "active" ? "No active assignments" : "No review history"}</p><h2>{view === "active" ? "New assignments will appear here." : "Your submitted assessments and closed assignments will appear here."}</h2></div>}
    {viewAssignments.length > 0 && filtered.length === 0 && <div className="empty-state"><p className="eyebrow">No matching assignments</p><h2>Adjust the search or status filter.</h2></div>}
    {filtered.length > pageSize && <div className="pagination"><span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of {filtered.length}</span><button className="button button-secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {page} of {pages}</span><button className="button button-secondary" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Next</button></div>}
  </div>;
}
