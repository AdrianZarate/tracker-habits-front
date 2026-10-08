# Flexible personal habits — Stage 3

## Objective
Each user can configure personal habits without affecting another user or losing historical information. Implement daily, selected-weekday and weekly-quota schedules; checkbox and measured targets; categories/colors/icons; edit/pause/archive; notes and past-record correction.

## Contract and constraints
- Personal configuration belongs to the owned HabitUser association. Existing catalog Habit identities remain stable and provide legacy defaults / possible template identity; personal edits must never mutate shared definitions.
- User explicitly chose original historical goals: prospective definition changes never recalculate past completion. Corrections use the goal effective on the record date. Preserve stored calendar labels and unique user/habit/date indexes; no bulk database rewrite.
- No new dependency, environment-file reads, live user-data mutations, push, PR, deployment or Stage 4–7 scope.
- Preserve API pre-existing package.json/yarn.lock changes byte-for-byte and exclude them from staging. API Yarn; frontend pnpm with scripts disabled.
- Retain explicit master-only delivery preference from previous work. Parent owns commits, task document and full Engram mirror; workers never commit. Native review applies to bounded work units only when user-owned RDD is on.
- Existing empty PATCH /habits/:id deactivation remains compatible; introduce a dedicated definition-edit endpoint rather than silently changing it.
- About 400 changed lines per unit is an advisory heuristic, not a cap. Keep tests and docs with behavior; surface naturally larger coherent units without minification or artificial splits.

## Tasks
- [x] T1 — Personal title/category/color/icon API persistence, creation and owner-scoped definition editing, legacy fallback and regression tests. **API master commit `33d195ea1cbcd19e8e42db27de046c6488bfd680`; checks passed, native approval acknowledged.** Route: delegated writer (multiple nontrivial source/test files); independent spot-check and native work-unit review. No goal or lifecycle redesign in this unit.
- [x] T2 — Validated schedule/quantity configuration with effective-dated goal revisions and compatible legacy defaults. **API master commit `a449539d4265b5abaa07455d29a0c4954244f078`; checks passed, native approval acknowledged.** Route: delegated API writer. Deterministic tests for daily/selected weekdays/weekly quota, original-goal retention and invalid payloads.
- [x] T3a — Current-day measured progress and immutable original configuration snapshots. **API master `310fe3ae06dd5a89bebdd83cf3620ce0a8819bf2`; checks passed and native approval acknowledged**. Route: delegated API writer (DTO/schema/controller/service/tests). Test replacement daily totals, goal thresholds, repeated calls, selected weekdays, owner/activity checks and legacy checkbox compatibility.
- [x] T3b — Notes and owner-scoped historical correction evaluated against original snapshots or the definition applicable on the record date. **API master `05dc5124d716f2d1e68c8b8b884cd1ba338d99d0`; checks passed and native approval acknowledged**. Route: delegated API writer. Test notes-only preservation, corrected quantities, date validation, legacy quantity gaps and foreign IDs.
- [x] T3c — Weekly progress and schedule read semantics. **API master `0ad4b413a8bb182b7618c8a25acd202badf428ce`; checks passed and native approval acknowledged**. Route: delegated API writer. Test ISO week boundaries/account dates, quota counts and original per-record completion across goal changes.
- [x] T4 — Pause/archive/reopen lifecycle without deleting history and HTTP integration coverage for the new contracts. **API master `574d34be270b44236c4e2fa6220a357aa763ce44`; checks passed and native approval acknowledged**. Route: delegated API writer; deterministic service and mocked Nest HTTP checks. Keep legacy endpoints compatible.
- [x] T5 — Frontend create/edit configuration forms and personal metadata presentation, API types and error states. **Frontend master `6840d7bb90c478be89e2e266c835dda306e6f969`; checks passed and native approval acknowledged**. Route: delegated frontend writer. Synthetic browser tests, build and lint.
- [ ] T6 — Frontend quantity/notes/history correction and pause/archive controls. **Next active unit: planning only; no T6 source changes yet**. Route: delegated frontend writer. Browser checks prove historical goals survive edits and two-user isolation through API fixtures.
- [ ] T7 — Cross-project regression checks, docs and Stage 3 acceptance evidence. Route: delegated verifier; parent integrates documentation/evidence. Full applicable unit/HTTP/browser checks and both builds/lint; explicitly record unverified live Mongo/Google behavior.

## Acceptance
- Personal edits and all record mutations use authenticated ownership; foreign IDs reveal no private data.
- Existing habits/logs remain accessible with legacy defaults; no destructive migration.
- Changes of target preserve original historical goal and completion, including after correction/reload.
- Schedules and units are validated, usable in the UI and covered by deterministic tests.
- Pause/archive keep history and do not silently allow active tracking.

## Verification evidence
- Prior exploration recovered from observations 11073/11075; current read-only scout mapped T1 and existing empty PATCH behavior.
- Initial Git state: both master; frontend clean, API only pre-existing package.json/yarn.lock dirty. Stage 3 evidence below supersedes that initial baseline.
- History policy approved by user, observation 11078.
- T1: observed RED 5 intended failures / 37 passes; GREEN 48 service / 182 full unit / 38 synthetic HTTP. `yarn exec` failed binary resolution; direct `node node_modules/typescript/bin/tsc --project tsconfig.build.json --noEmit --incremental false` passed. Independent no-fix local ESLint initially found 6 errors/2 warnings; writer corrected them and scoped lint passed 0/0, full unit/HTTP reran passing. Generated Nest build skipped in favor of noEmit because worker cannot delete dist; live Mongo and new endpoint through real HTTP remain unverified (new endpoint has service/controller/DTO tests).
- T1 commit: 10 paths, 745 additions/14 deletions (759 authored diff lines). Larger coherent unit retained validation/isolation tests without minification. Native high four-lens `review-3574e9e8ca997ab2` approved; exact acknowledgement returned authority burned. ASSESS committed-only from prior `ecbcfcba3dea60afaa8c16a527652bf03523bff1` reports consumed=true/reviewDue=false. Nonblocking R3/R4 orphan-edit warning at habits.service.ts:183 is a separate follow-up, not correction or reopened approval.
- Protected API SHA256 unchanged: package.json `8234563fc6919ba75a18ba1359be55a716e569af95febfacfaf866e4b7911e17`; yarn.lock `6a62555448f61e1207956450cc32a888eeb207b52973fddc7a58047ba939e381`.
- Routing incident resolved without source edits: parent folder nonGit; explicit human API repository consent obtained. Canonical Windows backslash repository_root succeeded. No parallel writers.
- Meaningful test-first RED/GREEN required for behavior changes; passive task documentation has no meaningful RED.

## T2 design
- Persist complete schedule+goal revisions with stable IDs and account-date effectiveFrom labels. New associations initialize today; definition changes take effect next local day so same-day logs are not reinterpreted. Metadata changes remain immediate.
- Atomic append of complete configurations avoids partial-field lost updates. Preserve all revisions; choose greatest applicable date, then final array position for same-date ties. Legacy fallback is daily checkbox target1 for every historical date; no invented association start timestamp.
- Daily / ISO weekdays1–7 / weekly completed-day quota1–7. Quantity target applies per recorded day/occurrence, not a weekly sum. Full nested configuration required when changing schedule/goals; metadata-only edits do not create revisions.
- Repeat POST preserves an existing association's configuration; PATCH changes it prospectively. T3 adds historical log snapshots/quantities and correction; T2 alone does not satisfy full history acceptance.

## T2 verification
- RED: 112 intended failures / 48 passes before implementation; supplementary raw-history-response regression 1 failure / 57 passes. Final GREEN: 336 unit tests across12 suites, 38 synthetic HTTP tests, noEmit TypeScript and changed-path lint0errors0warnings.
- Independent focused check: 58 service tests, TypeScript and lint passed; no owner/legacy/history-loss defect identified in bounded inspection. Protected manifest hashes remain unchanged.
- Commit11paths/1159additions39deletions (1198 authored lines) preserves full validation and calendar/history tests. Native high four-lens `review-424d258a3e6e05c6` approved with no advisories; exact acknowledgement returned authority burned.
- Post-ack ASSESS failed closed as unassessable due untracked `.codegraph/` despite committed-only range; followed conservative high-risk plan with independent full336unit+38HTTP/noEmit/scopedlint all passing. Do not claim assessment succeeded.
- `.codegraph/` appeared during read-only exploration tooling. Metadata is consistent with previous explorer initialization, provenance not independently proven. No contents/private data read; preserved and excluded from commit and review via explicit untracked exclusion. No cleanup/ignore edits.
- Generated Nest build and live Mongo/concurrency/Google remain unverified. Schedule enforcement, quantities, snapshots and historical corrections remain T3; present complete/incomplete endpoints still use legacy booleans. No frontend source work yet.

## T3 slicing and contract
- Split T3 into T3a/T3b/T3c to keep record writing, historical correction and weekly read behavior separately reviewable. Nine work units total, seven complete.
- `amount` is a replacement daily total, not an increment. Quantity goals require a finite nonnegative amount; checkbox bodyless completion stays compatible and rejects numeric amounts. New logs store an original configuration snapshot; existing snapshots are never rewritten by repeated completion.
- Missing legacy amounts are not inferred from boolean completion. Keep legacy dates/booleans and indexes; effective-date definitions resolve missing snapshots without bulk migration. T3b handles explicit corrections and notes.
- Selected weekdays constrain new records; weekly quota allows any weekday. Existing historical records remain accessible and are not removed when a schedule changes.

## T3a verification
- RED14 intended service failures/58 passes before implementation; GREEN409unit across14suites,46syntheticHTTP, noEmit TypeScript and scopedlint0/0. Independent112focused+46HTTP/typecheck passed; no blocking defect found in bounded inspection. Verifier full-diff permission query timed out, but source check and commands completed; no additional diff run claimed.
- APIcommit310fe3ae06dd5a89bebdd83cf3620ce0a8819bf2:10paths808add60delete868diff lines. Medium consolidated review `review-89b4cad619bfcf7b` approved/exactackburned. InformationalR3-concurrent-delete atservice358–365 is laterfollowup, not a correction/reopened approval.
- PostackASSESSunassessabledue.codegraph untracked declaration; conservative independent verifier already supplied112focused46HTTP/typecheck evidence. Native acknowledgement remains closed; assessment success is not claimed. GeneratedNestbuild/liveMongo concurrency remain unverified.
- Originalpackage/lock hashes unchanged and excluded. Currentdate undo still deletes today's log; no amount/snapshot backfill on old records.

## T3b verification
- RED27newroute404failures/46existingHTTPpasses; final515unit/75syntheticHTTP/noEmit/scopedlint0errors0warnings. Independent181focused/75HTTP/typecheck/sourcegitdiff passed with no blocking findings. Protected manifests unchanged.
- API master `05dc5124d716f2d1e68c8b8b884cd1ba338d99d0`:10paths1086add7delete1093diff lines. High4lens `review-380dce94f5d0a9d3` approved/exactackburned without advisories. ASSESS againunassessabledueuntracked.codegraph; conservativeindependentverificationdone, do notclaimassesssuccess.
- Existing inactive-owned records permit correction; new records require activeowner/explicitprogress. Notes-only does not recompute completion, missing legacy amounts/snapshots remainmissing. Currentdate complete/undo contractsunchanged; no auditlogproductadded. LiveMongo/concurrency/generatedNestbuildunverified.

## T3c design
- Add owner-scoped GET habit/week with optional selected account-date (default today). ISO Monday–Sunday bounds, seven labeled daily entries; existing snapshots govern each recorded day's goal, date-effective versions govern missing snapshots/empty days.
- Count stored completed days once each, never recalculate old boolean completion or sum quantities with potentially different units. Weekly target is the selected date's schedule quota and is explicitly labeled as such; return per-day original definitions so midweek changes remain visible rather than silently rewrite the week.
- Inactive-owned history stays readable, foreign/missing equivalent404, no mutations/new statistics dashboard. Default daily/checkbox for legacy dates preserved. Validate real labels and supported year boundaries.

## T3c verification
- RED10newrouteHTTPfailures/75existingpasses plus focused supported-year0001 validation failure. FinalGREEN576unit across17suites/88syntheticHTTP/noEmit/scopedlint0/0. Independent full576unit88HTTP/type/lint repeated and passed; no scoped semantic defects.
- API master `0ad4b413a8bb182b7618c8a25acd202badf428ce`:10paths750add4delete754diff lines. Mediumconsolidated `review-9cd77f6d799aa05b` approved/exactackburned withoutadvisories. ASSESSunassessabledue.codegraph; conservative independent fullverificationfulfilled. Never claimassessment succeeded.
- Read-onlyownerweekroute, inactivehistoryallowed, perdayoriginalsnapshots/storedbooleans preserved, selecteddatequota explicitlylabeled. ISOweek overflow beyondyear9999 rejects400; year0001 support uses sharedcalendar validator instead of IsDateString.
- Protected manifests unchanged. Full production/generatedNestbuild/liveMongo/Google/frontend/browserStage3checks stillunverified; no new dependencies or userdatabase writes.

## T4 design
- Optional association status active/paused/archived, no bulk backfill; missing status resolves from legacy active boolean. Synchronize active on all lifecycle writes and fail closed for inactive states in new-progress gates.
- Dedicated lifecycle PATCH explicitly sets state. Default list stays active; optional status filter supports paused/archived/all, with status/active fields additive. Inactive-owned detail/metadata/history/existing-record correction remain accessible.
- POST may resume paused but must atomically exclude archived associations and return restore-required409 on archive collision. The old empty PATCH pauses but never downgrades an archived row. No log deletion, goal changes or history migration.

## T4 verification
- RED10intendedHTTPfailures/90passes; final620unit across19suites/111syntheticHTTP/noEmit/scopedlint0/0. Independentfull620unit111HTTP/type/lint repeated and passed; no blocker found in bounded archive/legacy/history/ownership inspection.
- API master `574d34be270b44236c4e2fa6220a357aa763ce44`:11paths838add51delete889diff lines. High4lens `review-d71979dec2bf84ee` approved/exactackburned. InformationalR4-concurrent-create atservice110 is a separatelaterfollowup, notcorrection orreopenedapproval.
- ASSESSunassessabledue.codegraph declaration; conservativeindependentfullverificationdone. Protectedmanifesthashesunchanged, artifactpreserved/excluded. LiveMongo/concurrency/generatedbuildunverified.
- Lifecycle history/configuration/log snapshots retained; legacyemptyPATCHcannotdowngradearchive, POSTarchivecollision409requires explicitrestore. Additivestatus/active list/detailcontract readyforfrontend.

## T5 design and checks
- Create/edit personal title/category/color/icon and full schedule/checkbox-or-quantity configuration using the existing Spanish UI convention. Detail is the owner-aware edit host; show current and pending next-day definitions clearly. Metadata-only edits do not create a new goal revision.
- Preserve existing page/session flow; no Today redesign, stats, reminders, shared-template marketplace or new dependencies. Invalid/foreign edits use existing error handling. Do not issue bodyless completion for quantitative goals; measured controls belong T6.
- Use external `C:/Users/adria/AppData/Local/Temp/habit-tracker-core-regression/run-regression.cjs`: cached Playwright/Chrome, Vite envFile:false + synthetic API, no env-byte reads, no installer. Existing four spec files selected. Never update source/taskdoc while scope snapshots run.
- TypeScript noEmit plus lint, production Vite in-memory bundle `{envFile:false,build:{write:false}}`; avoid normal frontend Vite build loading private env or deleting dist. No runner/package/lock edits.

## T5 verification
- WriterRED11intendedbrowserfailures/29passes beforeimplementation, supplementaryJSON-orderregression1fail42passes; final44browserpasses. Independent44browser/typeapp+node/lint/inmemoryVitebundle repeated and passed (1814modules); no boundedissues. IndependentREDnotobserved, writerREDrecordpreserved.
- Browser44.7s/exit0/scope[]/VITE_STOPPEDtrue/PORT_4173_CLOSED; verifiedwrapperenvFilefalse/syntheticAPI/.envbytesexcluded/cachedCLI/noinstaller. No liveAPI/Mongo/Google or manualvisual acceptance claim. StaleBrowserslist/LFCRLFwarnings remain.
- Dependency Gitobject hashes unchanged: package.json439e0dea24b2dcf563eee496eab5b43bdb8a0bc0, pnpm-lock.yamlebadf7b1cab78809b79d4dbf40b0a6571030c122, pnpm-workspace.yamlc6790699fab1d7a71ffdeebfce93304dacbd26f5.
- Frontend master `6840d7bb90c478be89e2e266c835dda306e6f969`:9paths860add113delete973diff lines. Shared Spanish configuration form and safe icons; pendingconfigseededit/currentconfiggatestoday; semanticequalityomitsmetadata-onlyconfigPATCH; errorrefreshretryneverrepeatsmutation. QuantityshortcutdisableduntilT6.
- FirstreviewSTARTconsentexpiredafter10min: nativeinvocationfalse/lineage_createdfalse; freshinspect/STARTexactsamecommittedcandidatecreatedhigh4lens `review-fce5a93441f2967c`, approved/exactackburned. InformationalR3-quantity-undo(detail285)laterfollowupnotcorrection. ASSESScommittedrangeconsumedtrue/reviewDuefalse/nativeoutcomeclosed; no separate verifier required byplan, independentfunctionalchecks alreadyobserved.
- Frontendrepositoryexplicitinteractiveconsentgrantedthisturn; APIandfrontendprivateenv/dependenciesuntouched. Existing external runner/config not modified.

## Progress and next step
T1/T2/T3a/T3b/T3c/T4/T5 closed (7 of9). Resume T6: map and implement quantity tracking, dated notes/corrections, weekly progress and status/list controls; split into coherent UI work units if multi-area size forecasts warrant. Then T7 functional/regression closure. Preserve legacy date labels, log identity and original goals. Task document is parent-owned. Full mirror topic: `odd/flexible-habits/tasks`, project `habit-tracker`; canonical locator: `frontend/odd/tasks/flexible-habits.md`.
