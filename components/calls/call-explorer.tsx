"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";

type CallCardData = { id: string; title: string; description: string; topics: string[]; requirements: string; closesAt: string };
export function CallExplorer({ calls }: { calls: CallCardData[] }) {
  const [query, setQuery] = useState(""); const [topic, setTopic] = useState("");
  const topics = useMemo(() => Array.from(new Set(calls.flatMap((call) => call.topics))).sort((a, b) => a.localeCompare(b)), [calls]);
  const visible = calls.filter((call) => {
    const haystack = `${call.title} ${call.description} ${call.requirements} ${call.topics.join(" ")}`.toLocaleLowerCase();
    return haystack.includes(query.trim().toLocaleLowerCase()) && (!topic || call.topics.includes(topic));
  });
  return <>
    <div className="call-filters"><label>Search calls<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, topic, or requirement" /></label><label>Research topic<select value={topic} onChange={(event) => setTopic(event.target.value)}><option value="">All topics</option>{topics.map((item) => <option key={item}>{item}</option>)}</select></label><span aria-live="polite">Showing {visible.length} of {calls.length}</span></div>
    <div className="call-grid">{visible.map((call) => <Card key={call.id} className="call-card"><p className="call-deadline"><span>Submission deadline</span><time dateTime={call.closesAt}>{new Date(call.closesAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</time></p><h3>{call.title}</h3><p className="call-description">{call.description}</p><div className="topic-list">{call.topics.map((item) => <span key={item}>{item}</span>)}</div><p className="requirements-preview">{call.requirements}</p><Link href={`/calls/${call.id}`} className="button button-secondary">View call and requirements <span aria-hidden="true">→</span></Link></Card>)}</div>
    {visible.length === 0 && <Card className="empty-state"><p className="eyebrow">No matching calls</p><h2>Adjust your search or topic filter.</h2><button className="button button-ghost" onClick={() => { setQuery(""); setTopic(""); }}>Clear filters</button></Card>}
  </>;
}
