# Public landing — Stage 1

Provide a public introduction to HabitTracker before Google sign-in. This stage changes only the frontend and does not start the remaining roadmap stages.

## Scope and acceptance
- `/` is public and explains currently shipped habit creation, daily completion, and history.
- Clear calls to action lead to `/login`; existing protected routes and Google sign-in remain unchanged.
- Spanish copy follows the existing product convention; responsive dark/indigo/emerald presentation, semantic sections and keyboard-visible focus.
- Product preview is explicitly illustrative, not a live user dashboard or unavailable feature claim.
- Replace template document language/title/description and favicon reference where appropriate.
- No backend, authentication, dashboard, package manifest, lockfile, or unrelated registration changes.

## Tasks
- [x] T1 — Establish baseline and practical checks. **Baseline observed; source checks remain failing as documented below**. Route: delegated verifier (command execution trigger). Install locked frontend dependencies if needed; observe existing build/lint failures before source changes.
- [x] T2 — Implement public landing, route and metadata. **Implemented; focused lint and baseline GREEN passed; source commit 1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc on master**. Route: delegated writer (multiple non-trivial files). Read this document before editing. Tests first where applicable; no existing frontend test runner. Prefer browser-based behavior checks over source-string tests.
- [x] T3 — Verify public/protected navigation, responsive presentation and native review. **Observed browser GREEN and acknowledged native approval; full base checks remain failing under T4**. Route: delegated verifier and provider-bound review. Record failed/unavailable checks explicitly.

- [x] T4 — Resolve pre-existing build/lint blockers. **Resolved with pnpm migration; full green evidence in odd/tasks/frontend-tooling.md**. Full Stage 2 roadmap remains unstarted.

## Verification plan
- Baseline: `npm ci`, `npm run build`, `npm run lint` from frontend; install does not authorize manifest/lockfile edits.
- Post-change: focused TypeScript/lint checks and full build/lint; browser checks if tooling is available for root, login, signed-out protected routes, keyboard and mobile overflow.
- External Google OAuth requires configured credentials and human account; do not fabricate a signed-in test.
- Native RDD is enabled. Inspect/review only the frontend candidate using the facade; no ambient root initialization.

## Delivery and evidence
- Frontend initially clean on `master`, baseline HEAD `a8315c1`; working branch `feat/public-landing` created.
- API has pre-existing modifications in package.json and yarn.lock; do not touch them.
- Forecast: approximately 250–350 authored lines; delivery strategy `ask-on-risk`.
- User subsequently explicitly authorized frontend commits on master and selected commit-and-wait. Source commit `1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc` saves the exact approved landing+technical closure tree. Passive ODD evidence is a separate docs work unit. Push/PR/API changes remain unauthorized.
- Baseline: `npm ci` passed (263 packages; 25 reported vulnerabilities, not investigated/fixed). Existing `npm run build` fails at Register.tsx:8:11 (missing register); lint fails at AuthContext.tsx:32:7,93:17 and Dashboard.tsx:50:5. No tracked frontend diff before implementation. Browser RED observed: `/` redirects to `/login`, login heading instead of landing, zero login-link CTAs; one test failed with three expected assertions (exit 1). External harness `C:/Users/adria/AppData/Local/Temp/habit-tracker-stage1-baseline/run-baseline.cjs`; Chrome, @playwright/test 1.64.0. External/non-GET traffic blocked; Vite stopped and port 4173 closed.
- Implementation: Landing.tsx, App.tsx, index.html, public/habit-tracker.svg, tests/landing.spec.cjs and docs/public-landing.md. 259 additions / 3 deletions including new targets. Focused ESLint and diff --check passed; same external baseline now GREEN (public root, heading, three login CTAs). Full build/lint only reproduce documented base failures. Browser regression: 3 passed / 0 failed using `node C:/Users/adria/AppData/Local/Temp/habit-tracker-stage1-regression/run-regression.cjs`; baseline spot rerun 1 passed. Benefits/metadata/favicon/three CTAs, 320/375/768/1440 overflow, skip/main focus, keyboard CTA and signed-out protected/wildcard routes passed. Desktop/mobile screenshots inspected by verifier and parent; no clipping/overlap. Vite stopped, port 4173 closed. Live signed-in Google/API checks skipped (human credentials needed).
- Native review: medium / review-reliability, six paths, 262 authored lines. Lineage review-bc6423afd150abca approved; exact acknowledgement succeeded with `authority: burned`, outcome native-approved-acknowledgement-completed. No delivery authorized.
- Read-only ASSESS failed due to intended-untracked declaration requirement, risk unassessable; fallback requires independent verifier. Independent verifier above already completed applicable functional checks. No fabricated closed assessment.
- Existing dependencies report 25 vulnerabilities (2 low, 4 moderate, 19 high); audit remediation remains outside Stage 1. Third-party Google font/identity requests were intentionally blocked in browser tests and produced resource errors, not page exceptions. Browserslist warned about outdated data; no updates applied.
- Writer routing incident: root workspace is non-Git; explicit interactive user permission granted for canonical independent frontend repo. Native Windows backslash root accepted; forward-slash repository selector was rejected without writes.
- Memory mirror: `odd/public-landing/tasks` in project habit-tracker.

## Next step
Technical closure completed in odd/tasks/frontend-tooling.md: build/lint green, pnpm migration and7browser tests passed, new native approval acknowledged. Historical npm failure evidence above is superseded, not erased. View with `cd frontend && pnpm dev`; user chooses Stage 2. Dependency audit remains follow-up. Source commit `1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc` recorded on master; no automatic next stage or publishing.
