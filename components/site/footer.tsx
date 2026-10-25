import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div className="footer-brand">
          <p className="eyebrow">Jigjiga University</p>
          <h2>Research Call &amp; Peer Review</h2>
          <p>
            The university service for calls for papers, research submissions,
            and peer review.
          </p>
        </div>

        <nav className="footer-column" aria-label="Researcher links">
          <p className="footer-title">For researchers</p>
          <ul className="footer-link-list">
            <li><Link href="/">Browse calls for papers</Link></li>
            <li><Link href="/register">Create a researcher account</Link></li>
            <li><Link href="/sign-in">Track a submission</Link></li>
          </ul>
        </nav>

        <div className="footer-column">
          <p className="footer-title">For university staff</p>
          <p>
            Coordinators, reviewers, and administrators sign in to their
            authorized workspace.
          </p>
          <Link className="footer-staff-link" href="/sign-in">Staff sign in <span aria-hidden="true">→</span></Link>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© Jigjiga University</span>
        <span>JJU-RCPR · Research Call &amp; Peer Review System</span>
      </div>
    </footer>
  );
}
