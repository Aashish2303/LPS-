# LPS · Lean Project Delivery

A new Next.js application with Neon PostgreSQL, Managed Better Auth, project roles, and a command-based planning engine. No Sites service is used.

## Run

Node 24 is recommended. Install with `npm ci`. Supply the three server-only environment variables shown in `.env.example`. Apply `db/001_lps.sql` to an isolated database branch first, then to the intended production branch. Run `npm run dev`.

Checks: `npm test`, `npm run check`, `npm run build`. Commit the package lock. `npm audit --omit=dev` checks production dependencies.

## Planning flow

1. Create an account and a private project. Set project dates, trades and areas.
2. Add milestones and activity quantities with units, baseline dates and predecessor IDs. CSV schedule imports validate atomically, up to 500 rows. Add predecessor rows before successors. Native XLSX import is not included.
3. Select activities in pull planning. Identify handoffs in the phase register.
4. Allocate remaining quantities in the six-week lookahead. Add, correct or remove uncommitted forecasts.
5. Record constraints, owners and removal dates. Resolve with evidence. Predecessor scope must be complete before a successor can be promised.
6. Make weekly promises from allocations. Start the week to freeze its original quantity targets, due dates and denominator.
7. Log daily incremental actuals. Saving the same commitment/date replaces that entry. Scope, other reservations and predecessor sequencing are checked on the server.
8. Close the week after Sunday in India time. Every missed promise needs a reason and improvement action. Closed weeks are immutable.
9. Allocate unfinished scope to another week. Carryover never creates actual work or increases total scope.

## Measurement conventions

- Weeks are real Monday dates (`YYYY-MM-DD`), Monday–Sunday, in Asia/Kolkata.
- Quantities allow at most three decimals. Calculations sum integer thousandths; unlike units are never aggregated.
- PPC is count of promises fully achieved by their original due date / original promise count. Late work remains in cumulative scope but misses PPC. Empty denominators display no score.
- Project reliability uses total on-time completions / total frozen commitments across closed weeks, not a mean of percentages.
- TA here is the proportion of weekly promises whose allocation was first created before the week began. TMR is ready allocated activities / all allocated activities, snapshotted when the week starts. Confirm these operational definitions against the professor’s research protocol.
- CPM is computed from activity durations, project start, and finish-to-start, zero-lag dependencies. Calendar days are inclusive. Early/late CPM dates are displayed separately from the entered baseline. Resource levelling, work calendars, holidays, SS/FF dependencies and lag are not implemented.
- Ready means pull-planned, positive remaining scope, no unresolved constraints and completed predecessor scope. Handoffs require completion before the successor’s actual date.
- Activity baseline and scope can be edited before forecasts or promises exist. Once promised, those fields are frozen. Scope-change/rebaseline management is a future workflow.

## Access and consistency

- Auth is provided by Neon Managed Better Auth. Credentials are not stored by the application.
- All project reads and mutations independently check the server session and ownership or verified member email. Project roles: owner, editor, viewer. The owner manages access. Adding a member does not send an email.
- Shared accounts verify their email with an OTP in Settings. Email/password login, signout, password-reset code and verification-code UI are included. Email delivery still needs a real mailbox acceptance test. Custom SMTP is required for a production email setup under Neon’s current guidance.
- The browser never gets the database connection string. Tables have RLS enabled with no public policy; data is accessed only by the application server, which enforces project access on every request.
- Projects use one versioned JSONB aggregate, not independent browser writes. Each validated command locks the project with `SELECT FOR UPDATE`; stale versions return 409. A request UUID prevents a repeated command from being applied twice. State and audit event commit together.
- No whole-project overwrite/import endpoint is exposed. JSON exports contain a complete state snapshot and the latest 50 audit events. Audit records in the database retain the complete history. Backup restoration is not implemented in this release.
- Demo data is synthetic and held only in memory, with a visible demo banner. It never writes to the database.

## Infrastructure

- Vercel project: `lps`, project ID `prj_QLCkp5xzGOgJsT4umpFok0KRnC7Z`.
- Neon project: `weathered-leaf-00571504`, AWS Singapore.
- Main branch: `br-hidden-feather-b34iupg8`.
- Isolated verification branch: `br-tiny-shape-b35gn2a9`.
- Production and preview environment variables are separated. Preview uses the verification branch. Do not point tests at production.
- Existing Vercel deployment protection has been retained. Public release requires the owner’s explicit authorization to change production protection. Preview protection should remain enabled.
- Source repository: `https://github.com/Aashish2303/LPS-`, created by the project owner. The separate pre-existing `Aashish2303/LPS` repository remains untouched.

## Verification status · 27 October 2026

- Passing domain regression tests cover day corrections, decimal totals, scope overflow, duplicate promises, invalid dates, due-date PPC, binary completion, closeout requirements, frozen plans, carryover, forecast over-allocation, constraints, FS handoffs, future dates, CPM cycles/durations, separate units, year boundaries, demo integrity and forecast/activity corrections.
- TypeScript and optimized Next.js builds pass.
- Production dependency audit: zero known vulnerabilities after applying patched Zod and esbuild overrides. Auth SDK versions are pinned; its wrapper and peer APIs compile successfully.
- Live browser demo verified that a daily addition moved weekly actual from 20 to 30 and a correction reduced it to 25, retaining one entry per day.
- SQL schema was applied to the isolated branch, inspected for RLS on all three tables, then applied to the empty main branch.
- Full authenticated HTTP E2E was not completed: Vercel protection blocked the test client. The guard in `tests/http-e2e.mjs` requires an explicitly isolated environment. Do not treat a protection-generated 401 as proof of the application’s authorization.
- Two-account roles, signup/login persistence, email verification/reset delivery, concurrent HTTP mutations, idempotent HTTP retries, reload persistence, mobile browser interaction and backup restoration still need acceptance verification. Unit tests and implementation are not substitutes for these checks.

This is a tested implementation for review, not a claim of conference or production readiness. Review the research definitions with the professor and run the remaining acceptance checks before presenting measured project results.
