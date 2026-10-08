# Minimalist habit tracker core

## Approved product
Keep name-only create/edit, today's check/undo, a simple dated history and hide unused habits. Remove quantity controls, weekly goals, notes/corrections, appearance configuration and lifecycle/status filters from normal use. User approved this reduction; simplify the source instead of hiding old panels behind flags.

## Constraints
- Preserve all existing data, old quantities/notes/snapshots and backend compatibility; no bulk conversion or destructive migrations.
- No new dependencies, private environment reads/hashes, live database changes, push, PR, deployment or unrelated account/auth redesign.
- Existing Spanish UI and docs; English technical task records. Independent API/frontend repositories; user-authorized master-only commits, parent owns commits and task mirror. Single writer at a time.
- Preserve original API package.json/yarn.lock edits and both untracked .codegraph indexes; never initialize CodeGraph.

## Tasks
- [x] M1 — Explicit manual daily check compatibility API. API master `a0b19ef3a261cb96f7645c700cd43257175b9f3f`; native approval acknowledged and independent checks passed. Add an owner-active account-today check operation with optional manualCompletion provenance; preserve existing amounts, notes, original snapshots and unique day identity. Minimal check deliberately bypasses retired schedule/quantity gates; old calculated progress routes keep their contracts and clear manual provenance only for explicit progress changes. Tests/docs with behavior; no migration.
- [x] M2 — Name-only forms and simple habit detail/history. Frontend master `40f7ec4bab8ea329438ee6a59863a28e00199ed0`; native approval acknowledged and independent checks passed. Replace advanced configuration forms and week/correction/lifecycle panels with name edit, today's checkbox and hide action. Delete unused advanced panel code, update synthetic browser tests, preserve ownership/session/day/read-retry guards. Keep older data readable without exposing advanced controls.
- [x] M3 — Minimal dashboard/cards and client cleanup. Frontend master `ee5ef9c6aef2bca160dcfd402ea3c8cb87c9d409`; native approval acknowledged and independent checks passed. Today list with check/undo, simple name cards, create and a compact reversible hidden-habits section (not status filters). Unhide uses explicit active lifecycle; paused legacy habits count as hidden. Remove unused client helpers/types/UI code and obsolete advanced tests without deleting backend data/contracts.
- [x] M4 — Final regression and concise product documentation. Frontend documentation commit `e8675b3850af3af76fb4e2cf68d7bfb3f5aa0a9d`; automated acceptance complete, live/manual limits documented. Full applicable API unit/HTTP and synthetic browser checks, noEmit types/lint, in-memory frontend bundle. Record unverified live Mongo/Google/manual visual/generated Nest build honestly.

## Design
- Existing quantity habits reject bodyless legacy completion; the minimal UI needs an explicit manual check endpoint, not invented target amounts or destructive goal conversion.
- manualCompletion is optional provenance with no default/backfill. A checked measured record can retain its old amount/snapshot, but is explicitly user-checked rather than claiming its threshold was met. Explicit old quantity/correction writes return to calculated semantics; notes-only preserves the flag.
- Today undo retains existing delete-today behavior. Hide maps to archive without deleting history; compact hidden-list restore covers paused/archived legacy associations without a multi-status selector.
- Original goal/schedule metadata remains in stored history and compatible API; remove its frontend logic and dead code. No new weekly/statistics product work.

## Verification
Behavior changes use observed RED/GREEN. API: Yarn unit/HTTP, local TypeScript noEmit and no-fix scoped ESLint. Frontend: existing external cached synthetic browser runner, app/node noEmit, pnpm lint and Vite envFile:false/build.write:false. Expected Temp diagnostics and ignored Vite cache are authorized; source/task writes pause during snapshot runs. No normal pnpm build/dev or env reads.

## M1 evidence
- RED: unit 31/645 failures (18 missing-check, 7 schema, 6 cascading mock failures); HTTP 7/123 missing-route failures. Final GREEN 653 unit tests / 19 suites and 123 mocked HTTP tests, noEmit TypeScript, scoped no-fix ESLint and diff check passed. Original API manifest/lock SHA256 unchanged, dirty files/index preserved.
- Commit `a0b19ef3a261cb96f7645c700cd43257175b9f3f`: 8 files, 625 additions/13 deletions (638 diff lines, including tests). Medium consolidated `review-46d447244e189f8d` approved without advisories; exact acknowledgement burned authority. ASSESS unassessable due untracked index, so independent verifier repeated full 653/123/type/lint checks; no bounded blockers.
- Explicit manual check ignores retired goals/schedules for current daily tracking, preserves amount/note/snapshot and marks manual provenance. Notes-only retains provenance; explicit calculated progress clears it. Account-day captured before awaits, identity-loss returns 409. No migration or real Mongo concurrency/Google/emitted build verified.

## M2 evidence
- Name-only create/edit writes omit old metadata/configuration; detail uses bodyless manual daily check, undo and stored month-history booleans, confirmed hide/restore. Weekly/correction panel source files deleted by parent after worker emptied them because its deletion rule forbade unlinking. Source +135/-782 (net -647); retired advanced UI tests replaced with applicable core coverage.
- RED 5 intended failures/127 passes; additional stale-day edit-opening regression failed with 117 passes, then guard fix. Final 118 browser tests independently repeated after physical deletions; app/node types, lint, in-memory Vite bundle (1814 modules), diff check passed. Scope [], Vite stopped, port closed, dependency hashes unchanged. Dashboard/status/card reduction still reserved for M3.
- Frontend `40f7ec4bab8ea329438ee6a59863a28e00199ed0`: 10 files +537/-1771 (2308 diff lines including retired tests). High four-lens `review-8285f871151fa755` approved/exact acknowledgement burned. Nonblocking stale-form-recovery and midnight-create-lock warnings are separate follow-ups. ASSESS unassessable index; independent functional fallback completed. Live integration/manual visual remain unverified.

## M3 scope check
Fetch all owned habits once, split active vs hidden (paused/archived) locally, native details section for hidden names/detail links, no status selector or new dashboard restore mutation. Active checkbox uses manual check for all legacy goals, undo unchanged; retain request/token/account-day/route guards. Remove card metadata/configuration code and unused API helpers only after current-source import checking. Scout reported stale Detail imports; live grep confirms advanced exports are referenced only within HabitCard, so no Detail write is needed.

## M3 partial evidence and scope stop
- M3 source is implemented but not complete: Dashboard fetch-all/local hidden partition, name-only cards, bodyless manual check/undo and narrow API client models. Five authorized files modified; source +91/-212 (net -121), current total +292/-325. Docs not yet updated; no M3 commit or review.
- Observed RED 30 failures/96 passes. GREEN attempt 10 failures/116 passes: nine noncanonical synthetic date fixtures and one retired button selector in `tests/calendar-session.spec.cjs`. Types app/node, lint and in-memory build passed (1814 modules); both runner snapshots scope [], Vite stopped, port closed. Dependency hashes unchanged.
- Worker stopped before writing outside allowed surfaces. Human explicitly selected approve for `tests/calendar-session.spec.cjs`, only selector/assertion migration from retired completed button to checkbox, preserving calendar behavior and coverage. This exact path is now authorized alongside existing M3 surfaces; resume same writer. Existing authorized fixture corrections/docs also pending. No live verification and no completed M3 claim.

## M3 completion evidence
- Human approved the exact calendar selector/assertion migration; parent bounded diff confirms three replacements to checkbox/checked assertions, no calendar behavior changes. Nine fixture anchors normalized to actual API date contract without source workaround. Documentation updated for completed minimal dashboard and historical compatibility.
- Final writer 126 browser passes; one intermediate unchanged Detail edit-opening timeout (125 passes/1 failure) did not recur in unchanged rerun or independent 126-pass run (2.2m). Cause unconfirmed. App/node noEmit, lint, in-memory Vite bundle (1814 modules) and diff checks passed; scope [], Vite stopped, port closed, dependency hashes unchanged.
- Frontend `ee5ef9c6aef2bca160dcfd402ea3c8cb87c9d409`: 8 files +317/-343 (660 diff lines), source +91/-212 (net -121). High four-lens `review-6bb42ccee636ee10` approved without advisories/exact acknowledgement burned. ASSESS unassessable index; conservative independent full functional checks fulfilled.
- Name-only cards, manual check/undo for all legacy goals, active-only stored counts, compact hidden name links, no status selectors or retired advanced client exports. M2+M3 frontend source net reduction 768 lines. Backend compatibility retained, not wholesale deleted; historical quantities/notes/goals unchanged.

## M4 closure plan
Reuse final independent API 653 unit/123 HTTP/type/lint evidence for unchanged `a0b19ef` and final independent frontend 126 browser/type/lint/in-memory build evidence for unchanged `ee5ef9c`. Verify Git heads/scope, add short verification/limitations section to minimalist guide, close canonical tasks/mirror/todo. No additional source behavior or redundant suite reruns for passive documentation.

## M4 final evidence and limits
- Reused independently observed full API 653 unit / 19 suites, 123 mocked HTTP, noEmit types and scoped no-fix lint for unchanged API `a0b19ef3a261cb96f7645c700cd43257175b9f3f`. Protected package.json/yarn.lock SHA256 matched the prior baseline before/after; only original manifest/lock edits and untracked index remain.
- Reused final independently observed frontend 126/126 browser tests (2.2m), app/node noEmit, lint and in-memory bundle (1814 modules) for unchanged source `ee5ef9c6aef2bca160dcfd402ea3c8cb87c9d409`. Scope [], Vite stopped, port closed, manifest/lock hashes unchanged. No private environment reads, dependencies, live data changes, push or PR.
- Parent current Git numstat confirms source reduction against `a9269cc`: 225 added / 993 deleted across src, net 768 lines removed. Old quantities/notes/snapshots retained on the backend; new manual checks explicitly distinguish user completion without inventing quantities. Title-only edits and hiding never convert historical data.
- `e8675b3850af3af76fb4e2cf68d7bfb3f5aa0a9d` adds a short Spanish verification/limits section to docs/minimalist-habits.md. Structural readback and diff check passed; passive documentation has no meaningful RED/native source review. Suites were not redundantly rerun after doc-only changes.
- No current failing required check. Earlier fixture/date/selector failures and one nonreproduced Detail timeout are recorded above, not silently counted as passed. Calendar selector scope explicitly approved; parent diff verified unchanged calendar behavior.
- Not verified: live Mongo/schema/index/concurrency, real Google/OAuth, manual visual acceptance, emitted Nest build (noEmit substitute). Existing Browserslist/CRLF advisories remain. ASSESS was unassessable due untracked indexes, not passed; exact native approvals stand and independent checks fulfill conservative fallback. M2 nonblocking form recovery warnings remain separate follow-ups.

## Progress
4/4 closed. Minimalist core implemented with automated acceptance; next human action is manual UI and live integration validation. Do not expand the product without a new explicit need. Canonical task document/mirror/todo reconciled; no source work pending. Canonical file: frontend/odd/tasks/minimalist-core.md; memory mirror: odd/minimalist-core/tasks, project habit-tracker. Existing Stage 3 evidence remains intact.
