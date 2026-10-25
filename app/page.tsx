import Link from "next/link";
import { connection } from "next/server";
import { CallExplorer } from "@/components/calls/call-explorer";
import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Calls for Papers",
  description:
    "Browse active Jigjiga University calls for papers, review submission requirements, and submit your research.",
};

export default async function HomePage() {
  await connection();
  const now = new Date();
  const calls = await prisma.researchCall.findMany({
    where: {
      status: "OPEN",
      opensAt: { lte: now },
      closesAt: { gte: now },
    },
    select: {
      id: true,
      title: true,
      description: true,
      topics: true,
      requirements: true,
      closesAt: true,
    },
    orderBy: { closesAt: "asc" },
  });

  return (
    <main className="shell content-page calls-page">
      <section className="calls-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Jigjiga University · Research Call & Peer Review</p>
          <h1 id="page-title">Calls for Papers</h1>
          <p>
            Official research opportunities from Jigjiga University. Find a call
            that fits your work, review its requirements, and submit before the
            deadline.
          </p>
          <div className="calls-heading-actions">
            <a href="#open-calls" className="button button-primary">
              Explore open calls <span aria-hidden="true">↓</span>
            </a>
            <Link href="/sign-in" className="text-link">
              Already submitted? Track your work
            </Link>
          </div>
        </div>
        <aside className="submission-guide" aria-label="How to submit">
          <p className="submission-guide-title">From call to submission</p>
          <ol>
            <li><span>01</span><div><strong>Choose a call</strong><small>Check its topics and eligibility.</small></div></li>
            <li><span>02</span><div><strong>Prepare your materials</strong><small>Follow the listed format and requirements.</small></div></li>
            <li><span>03</span><div><strong>Submit before closing</strong><small>Sign in to submit and keep your reference.</small></div></li>
          </ol>
        </aside>
      </section>

      <section className="calls-section" id="open-calls" aria-labelledby="open-calls-heading">
        <div className="calls-section-heading">
          <div>
            <p className="eyebrow">Currently accepting submissions</p>
            <h2 id="open-calls-heading">Open calls</h2>
          </div>
          <span className="calls-count" aria-live="polite">
            {calls.length} {calls.length === 1 ? "open call" : "open calls"}
          </span>
        </div>

        {calls.length ? (
          <CallExplorer calls={calls.map((call) => ({ ...call, closesAt: call.closesAt.toISOString() }))} />
        ) : (
          <Card className="empty-state calls-empty-state">
            <p className="eyebrow">No open calls</p>
            <h2>There are no calls accepting submissions right now.</h2>
            <p>
              New opportunities appear here during their published submission
              period. If you have already submitted, you can still sign in to
              check your submission status.
            </p>
            <Link href="/sign-in" className="button button-secondary">
              Sign in to track a submission
            </Link>
          </Card>
        )}
      </section>

      {calls.length > 0 && (
        <p className="calls-footer-note">
          Call details include the submission requirements, accepted file types,
          and review criteria. <span>Read them before you begin.</span>
        </p>
      )}
    </main>
  );
}
