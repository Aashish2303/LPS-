# Lean Classroom · Construction Planning Lab

A new Next.js application with Neon PostgreSQL, Managed Better Auth, project roles, and a command-based planning engine. No Sites service is used.

## Run

Node 24 is recommended. Install with `npm ci`. Supply the three server-only environment variables shown in `.env.example`. Apply `db/001_lps.sql` and `db/002_rate_limits.sql` to an isolated database branch first, then to the intended production branch. Run `npm run dev`.

Checks: `npm test`, `npm run check`, `npm run build`. Commit the package lock. `npm audit --omit=dev` checks production dependencies.

## Planning flow

1. Create a private project and open **Phase Plan**. Use **CSV template** to download a model with dates, float, predecessors and an example constraint.
2. Import the CSV. Imports are atomic, accept up to 500 activities per file, and reject duplicate IDs and invalid dependencies. The earliest early start and latest late finish across the phase schedule set the project dates. Where a late finish is missing, the early finish is used.
3. Open **Lookahead**. The next six weeks automatically show the quantities scheduled within each activity’s inclusive early date range. The split uses calendar-day overlap and integer thousandths so the weeks add up to the original scope. A week following closeout includes the remaining scope due by its end, after deducting the actual quantity recorded through the preceding week end.
4. Add or review constraints in Lookahead and resolve them with evidence in the Constraint log. Open constraints block the activity and all its downstream dependencies. An unfinished predecessor alone does not block a successor; record a constraint if its handoff is at risk.
5. Review **Weekly work plan**, select ready work, confirm the fixed forecast quantity, owner and due date, then start the week. This freezes the promises and the forecast used for readiness metrics.
6. In **Daily check-in**, enter the quantity completed on each date in the active week, including future dates for exercises. Saving the same commitment/date replaces the previous entry. Weekly and cumulative actuals derive from that ledger.
7. When you finish the practice week, choose a primary reason code and an improvement action for each missed promise. RC-16 also requires a reason note. **Save & lock week** records the reasons and closes the week in one transaction. You can close an active week on any day.
8. **Trends & metrics** shows the weekly PPC line and results table, activity results for the selected week, and the distribution and top three reasons for missed promises in closed weeks.

The CSV template uses `id,name,trade,area,owner,unit,total,early_start,early_finish,late_start,late_finish,float,predecessors,constraints,constraint_category,constraint_owner,constraint_due`. Use ISO dates and separate predecessor IDs or multiple constraint descriptions with `|`. Legacy headers such as `Sl. No.`, `EPS`, `EPF`, `LPS`, `LPF`, `Quantity` and `UOM` are accepted. Older CSVs using `start` and `finish` still import. The signed float in the CSV is preserved when supplied.

## Measurement conventions

- Weeks are seven calendar days anchored to the project start date (`YYYY-MM-DD`). The exercise advances after closeout, independently of wall-clock dates. Existing recorded weekly boundaries are preserved when older projects are upgraded.
- Quantities allow at most three decimals. Calculations sum integer thousandths; unlike units are never aggregated.
- PPC is count of promises fully achieved by their original due date / original promise count. Late work remains in cumulative scope but misses PPC. Empty denominators display no score.
- Project reliability uses total on-time completions / total frozen commitments across closed weeks, not a mean of percentages.
- TA here is the proportion of weekly promises whose allocation was first created before the week began. TMR is ready allocated activities / all allocated activities, snapshotted when the week starts. Confirm these operational definitions against the professor’s research protocol.
- CPM is computed from activity durations, project start, and finish-to-start, zero-lag dependencies. Calendar days are inclusive. Early/late CPM dates are displayed separately from the entered baseline. Resource levelling, work calendars, holidays, SS/FF dependencies and lag are not implemented.
- Classroom readiness means positive remaining scope and no unresolved constraints on the activity or any transitive predecessor. An unfinished predecessor alone does not block a weekly commitment, week start, daily progress, or a quantity correction. Record a constraint when a handoff is at risk; the constraint blocks that activity and all its successors for the affected dates. Baseline FS scheduling, scope limits, daily reasons and closed-week locks remain enforced.
- Activity baseline and scope can be edited before forecasts or promises exist. Once promised, those fields are frozen. Scope-change/rebaseline management is a future workflow.

## Access and consistency

- Auth is provided by Neon Managed Better Auth, not Auth0. User passwords are handled by the provider and stored in `neon_auth.account` as salted password hashes. Better Auth documents `scrypt`; an aggregate-only check of the current credential records matched its salt/hash representation. No password values or hashes were retrieved or logged. Application tables, exports and Markdown documentation contain no user passwords.
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
- Production URL: `https://lps-lean.vercel.app`. Project APIs still require an authenticated session and project access. Preview deployment protection remains enabled.
- Source repository: `https://github.com/Aashish2303/LPS-`, created by the project owner. The separate pre-existing `Aashish2303/LPS` repository remains untouched.

## Verification status · 27 October 2026

- Passing domain regression tests cover day corrections, decimal totals, scope overflow, duplicate promises, invalid dates, due-date PPC, binary completion, closeout requirements, frozen plans, carryover, forecast over-allocation, constraints, constraint-only successor readiness, all seven learning dates entered in advance, CPM cycles/durations, separate units, year boundaries, demo integrity and forecast/activity corrections.
- TypeScript and optimized Next.js builds pass.
- Production dependency audit: zero known vulnerabilities after applying patched Zod and esbuild overrides. Auth SDK versions are pinned; its wrapper and peer APIs compile successfully.
- Live browser demo verified that a daily addition moved weekly actual from 20 to 30 and a correction reduced it to 25, retaining one entry per day.
- SQL schema was applied to the isolated branch, inspected for RLS on all three tables, then applied to the empty main branch.
- Full authenticated HTTP E2E was not completed: Vercel protection blocked the test client. The guard in `tests/http-e2e.mjs` requires an explicitly isolated environment. Do not treat a protection-generated 401 as proof of the application’s authorization.
- Two-account roles, signup/login persistence, email verification/reset delivery, concurrent HTTP mutations, idempotent HTTP retries, reload persistence, mobile browser interaction and backup restoration still need acceptance verification. Unit tests and implementation are not substitutes for these checks.

This is a tested implementation for review, not a claim of conference or production readiness. Review the research definitions with the professor and run the remaining acceptance checks before presenting measured project results.

## Routing and security changes

- Project pages use `/projects/{uuid}/{section}`. Demo pages use `/demo/{section}`. The selected review week is retained in `?week=YYYY-MM-DD`. Reload, deep links and browser back/forward use the URL. The legacy `/?demo=1` link redirects to `/demo/overview`. Unknown sections return 404.
- Sign-in, signup, recovery and verification use `/login`, `/signup`, `/forgot-password`, `/reset-password` and `/verify-email`. An unauthenticated project URL redirects to sign-in with a validated internal return path. API authorization runs independently of page routing.
- All mutation requests require an exact Origin and JSON content type. The actual streamed body is capped at 8 KiB for auth, 4 KiB for project creation and 512 KiB for project commands. Strict schemas reject unexpected fields, unsupported actions, invalid roles, identifiers, dates, quantities and import commands.
- Auth forwarding is restricted to the email/password, session, signout and OTP endpoints used by this UI. Unused provider admin, account-deletion and arbitrary proxy routes are not exposed through the app.
- Database-backed rate limits use atomic upserts shared by all server instances. Login permits 5 attempts per account/IP pair per 15 minutes, 30 per IP per 15 minutes, and 20 per account per hour. Successful attempts also count. Signup is capped at 5 per IP/hour. Code requests are capped at 10 per IP/hour and 3 per account/IP pair per 15 minutes, with an additional account cap. OTP verification/reset attempts also have pair/account caps. Auth responses return 429 and Retry-After when blocked. Counter failures fail closed with 503.
- Only Vercel's platform-set client-IP header is trusted; local callers share an unknown-IP bucket. IPv6 clients share a /64 bucket. Rate-limit keys are HMAC digests using a server-only, domain-separated secret; raw addresses, emails and passwords are not stored in the counter table. Expired counters are removed in bounded batches after a one-day retention buffer.
- The identity provider remains responsible for its own public endpoint protection. The custom limits above protect the application gateway; they do not configure or replace Neon's upstream security policy.
- Auth errors are generic. Recovery-code requests have the same public result for known and unknown accounts. Database/provider error details and request credentials are not logged or returned. Business-rule errors still explain useful planning corrections such as scope overflow or a locked week.
- New and reset passwords require 12–128 characters. Existing passwords can still sign in. Password whitespace is preserved. Password fields use browser password-manager autocomplete and never persist in application state, exports or logs.
- CSP, frame restrictions, MIME sniffing prevention, referrer policy and browser permission restrictions are set in response headers. API/session responses are not cached. CSP permits inline scripts/styles required by the current Next.js rendering; it is not a nonce-based policy.
- Project creation is serialized per owner so simultaneous requests cannot bypass the 20-project cap. Existing owner/editor/viewer checks, optimistic versions and transactional audit writes remain in place.

Validation for this change: 35 domain/security tests and the optimized build pass. Local HTTP checks cover public routes, unknown sections, legacy redirect, sign-in return routing and anonymous API denial. The isolated database verifies limit persistence, sixth-attempt denial, expiry reset and RLS. Real mailbox delivery and a complete signed-in two-account browser flow still need acceptance testing; synthetic/mock checks are not evidence of email delivery.

## Classroom workflow · 22 November 2026

- Lean Classroom is the product name. Repository, database table names and deployment hostname retain their existing identifiers for continuity.
- Lookahead is the current exercise week plus five subsequent seven-day periods, with no date controls. Closing a week opens the next Lookahead automatically.
- Every activity/week cell can save a constraint scoped to that week. It blocks that activity and downstream work from the affected week until resolved. Imported unscoped constraints apply throughout the exercise until resolved.
- Weekly promises equal the complete forecast quantity. Quantities cannot be edited in the promise dialog or lowered through a promise command. Starting a week validates the forecast again and freezes it.
- New and upgraded live projects require an RC-01–RC-16 delay reason only when the saved actual is below that day’s fixed plan. RC-16 requires an explanation for a shortfall. Meeting/exceeding the daily plan and zero-target days need no reason. Advancing requires saved quantities and valid reasons for any shortfalls; ON_PLAN cannot bypass this check.
- Days advance through explicit buttons, with a server-validated cursor. Saved days can be reviewed and corrected until closeout. Same-day saves replace the entry rather than adding it twice. Daily reasons are available alongside weekly results in Trends & metrics.
- Start and closeout allow simulated future weeks. An empty or fully blocked week can be closed, with PPC displayed as unavailable rather than a fabricated zero.
- IIT Madras and ILCE images are served locally from the institutions’ public logo assets. Their presence does not assert endorsement.
- Existing closed weeks and their records are kept immutable. Older projects with recorded weeks keep those boundaries; new projects and imports without recorded history use the project start.

## Performance update · 22 November 2026

- Section changes within an already loaded project use the Next.js-integrated History API. URL deep links, browser back/forward and the selected review week continue working. Switching projects and entering authentication routes use the normal router. Every data read and write retains its server authorization and validation.
- Public landing and demo pages render without waiting for the authentication provider. The auth client is loaded on demand; authenticated project access still waits for session restoration.
- Immutable UI snapshots opt into an indexed ledger for exact date-filtered totals, predecessor traversal and forecast/readiness memoization. Command execution clones the snapshot and always uses an uncached mutable ledger, avoiding stale validation results. Cache keys are weak object references, isolated to each project snapshot.
- CPM is computed when viewing Phase Plan. Long activity lists defer offscreen rendering. Reused date/number formatters avoid repeated locale setup.
- DM Sans and Manrope variable fonts are served by the deployment with font-display swap instead of a runtime Google Fonts stylesheet chain. Licenses are in app/fonts.
- Run npm run bench:planning for a reproducible synthetic calculation comparison; this is a computation benchmark, not a promise about end-to-end network latency.

- Daily check-in shows the selected date’s plan, entered/saved actual and shortfall or surplus, plus an expandable seven-day plan. The fixed weekly quantity is split over the activity’s inclusive planned dates inside the week, ending by its promised due date. Overdue carryover uses the current week through that due date. Cumulative integer-thousandths rounding makes the daily plan add up exactly to the weekly promise. Days outside the work window have zero planned quantity. Daily actuals do not recalculate the plan.

- Daily delay reasons are required on the server only for actual quantities below that date’s planned quantity. Meeting/exceeding the plan or a zero target needs no reason. New shortfalls cannot use ON_PLAN; RC-16 still requires an explanation. Legacy missing/ON_PLAN shortfalls require a valid code when revised. Daily cards distinguish original activity start/finish from the weekly commitment due date. Actual entries do not automatically reforecast the project completion date.
