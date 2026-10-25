# Jigjiga University Research Call & Peer Review System

**JJU-RCPR** is a standalone university application for publishing research calls, receiving submissions, screening proposals, assigning reviewers, collecting peer reviews, recording coordinator decisions, managing revisions, and notifying researchers. It is independent of the JJU Research Repository.

## Start locally

1. Install dependencies and create a local environment file only if one does not already exist: `npm install && cp -n .env.example .env`.
2. Configure PostgreSQL, `AUTH_SECRET`, `NEXTAUTH_URL`, and either local MinIO or Cloudflare R2. Email delivery is optional.
3. Apply the existing migrations with `npm run db:deploy` and generate the Prisma client with `npm run db:generate`.
4. Provision the first system administrator using `npm run provision:admin` with the one-time `INITIAL_ADMIN_*` values set in `.env`.
5. Run `npm run dev` and open `http://localhost:3000`.

See [docs/setup.md](docs/setup.md) for the full infrastructure and deployment steps and [docs/architecture.md](docs/architecture.md) for workflow and access boundaries.

## Main areas

- Public open-call directory, search, call details, registration, and secure submission.
- Researcher portal with private history, decisions, notifications, and revision uploads.
- Coordinator workspace with separate overview, call management, all-submissions, screening, reviewer-assignment, and final-decision pages.
- Separate administrator area for staff and researcher accounts, access recovery, activation controls, and read-only audit review. Coordinators do not administer accounts.
- Reviewer workspace for active assignments, conflict declaration, saved review drafts, structured scoring, and submitted recommendations.
- Scheduled calls visible before opening, with submission actions enabled only during the call window and call-specific required document checklists.
- Reviewer expertise and configurable active workload limits used by coordinator assignment tools and enforced on the server.
- Coordinator CSV exports for submissions and review workload, scoped to owned calls.
- Optional pre-provisioned staff OIDC sign-in, account TOTP MFA with one-time recovery codes, and optional fail-closed ClamAV document scanning.
- Administrator-managed researcher identity verification and audited access recovery when a researcher cannot use their registered email.

If email delivery is not configured, account verification and recovery are handled by an administrator. Administrators can verify researcher accounts and, after confirming identity under university policy, issue a one-time temporary password. The password is not emailed, is displayed once, and must be changed at first sign-in.

## Verification commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```
# jju-rcpr
