# Restore frontend checks and migrate to pnpm

User authorized prior build/lint repairs and npm-to-pnpm migration after approving Stage 1 landing. This is a technical closure, not implementation of the full Stage 2 roadmap.

## Scope and acceptance
- Full frontend build and lint pass without disabling lint rules, unsafe casts, or invented email/password auth.
- Remove unsupported unmounted Register page; preserve Google sign-in, session restoration, navbar/guards, dashboard refresh and landing.
- Split context/hook/provider exports as needed and stabilize dashboard effect dependencies.
- Import existing npm resolutions into pnpm lock; preserve dependency ranges and avoid unrelated upgrades/audit fixes.
- Pin pnpm 12.8.1, use installs with --ignore-scripts, verify frozen lock and update active usage docs. User explicitly selected persistent policy via new pnpm-workspace.yaml ignoreScripts=true; verify native effective config.
- API/Yarn and existing API package.json/yarn.lock edits remain untouched.
- User now explicitly authorizes committing the pending frontend changes on master only, then waiting. No API commits, push, deployment or Stage 2 implementation authorized.

## Tasks
- [x] T1 — Repair build/lint with behavior-preserving regression coverage. **Build/lint and 7 browser regressions independently passed; source commit 1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc on master**. Route: delegated writer (multiple non-trivial files). Reproduce actual failing checks before edits, then minimal fixes, GREEN and refactor checks. Browser mock coverage supplements compiler/lint RED rather than inventing a failing refactor test.
- [x] T2 — Import npm lock and migrate reproducible installs/docs to pnpm. **Effective config, frozen install, build/lint and 7 browser tests passed; source commit 1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc on master**. Route: same single writer after T1 checks pass. Configuration migration uses structural checks/install/build; no meaningful behavioral RED for lock conversion. Verify import resolution differences, ignore lifecycle scripts, remove superseded npm lock only after successful import.
- [x] T3 — Independent build/lint/frozen-install/browser verification and native review. **Passed independent checks; native approval acknowledged. source commit 1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc on master**. Route: verifier plus provider-native review on frontend only. Record all failed/skipped checks.

- [x] T4 — Save approved frontend snapshot on master and record commit evidence. **Source commit 1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc recorded; passive continuity evidence delivered separately**. Route: parent mechanical Git delivery; source changes already delegated/verified/reviewed. Commit source/tests/setup docs together, then passive ODD evidence separately; never include API changes.

## Verification
- T1 RED/GREEN: `npm run build`, `npm run lint`; green again with pnpm after migration.
- Migration: `pnpm import`, `pnpm install --ignore-scripts`, `pnpm install --frozen-lockfile --ignore-scripts`. Existing pnpm 12.8.1 / Node24.20.0. No global installation needed.
- Functional: baseline external harness and existing 3-test landing regression; add bounded mocked session/dashboard regression if practical, block all real external/API traffic and do not use real Google accounts.
- Check package manifest/lock consistency, generated lock changes, `git diff --check`, preserved API and landing files. Ignored node_modules/build caches and dist outputs are expected tool artifacts.
- Native RDD on; inspect scoped to authorized frontend root. Prior landing approval is for old exact candidate only, not these new edits.

## Baseline and delivery
- Branch feat/public-landing, HEAD a8315c1. Landing six-path changes are already present, uncommitted, approved under review-bc6423afd150abca; preserve them.
- Prior build error: Register.tsx:8:11 missing register. Lint: AuthContext.tsx:32:7,93:17; Dashboard.tsx:50:5.
- Existing npm audit reported 25 vulnerabilities; migration does not claim remediation.
- Forecast new authored source/docs/tests around 150–250 lines; generated lockfiles excluded. Delivery strategy ask-on-risk. User permission granted: commits on master only; source identity recorded below.
- T1 evidence: observed npm build/lint RED, both now GREEN (writer and independent verifier). Context/hook/provider split, Dashboard callback fixed, obsolete Register removed (parent guarded deletion of empty file). Landing six files byte-preserved. Existing baseline 1-test and landing 3-test reruns passed. New tests/auth-dashboard.spec.cjs four synthetic session/dashboard tests plus three landing tests: 7 passed, no failures. Browser/wrapper exit0, scope changes [], Vite stopped and port4173 closed.
- External runner incident: verifier could not create even external files under its stricter read-only role. Parent mechanically copied existing wrapper/config into C:/Users/adria/AppData/Local/Temp/habit-tracker-tooling-regression, selecting both specs, no new verification logic. No source/test edits to mask results. First combined run passed 7 tests but wrapper exited2 because parent concurrently updated this task document. Exact path reconciled; rerun unmodified with parent writes paused passed7/wrapper0/scope[]. Failed first wrapper attempt retained as incident evidence.
- Full mirror topic odd/frontend-tooling/tasks in habit-tracker.

- T2 preliminary: pnpm import and normal/frozen --ignore-scripts installs passed with CI=true; pnpm build/lint and all7 browser tests passed. All318 unique application package/version/integrity pairs and21 direct dependencies preserved; no app version drift. Generated pnpm lock3045lines. packageManager pinned pnpm@12.8.1. Provisional .npmrc ignore-scripts config returned undefined; user chose A authorizing pnpm-workspace.yaml persistent policy. Parent removed superseded .npmrc and npm package-lock only after successful import/install/graph checks. Workspace persistent ignoreScripts:true verified via both `pnpm config get ignoreScripts` and `pnpm config get ignore-scripts` true. README and landing docs updated (118 total lines); root-only workspace config1line. Normal/frozen installs, pnpm build/lint and7browser tests all pass after final policy/docs; source/spec hashes13unchanged; npm lock/.npmrc absent. Browserslist warning remains.

- T3 final independent verification: pnpm12.8.1; both config queries true; frozen ignore-scripts install, build/lint, vite7.3.1 and diff-check passed. Seven browser tests passed, wrapper exit0/scope[]/serverstopped/portclosed. Before/after manifest and lock SHA256 unchanged: package.json e2da1fd54c54f52e19b78f59f317af40d75080cc8b49ea1c85a17aa4a313c97d; pnpm-lock.yaml afce6c098001a89f902f5d55b4881ea2350dbd00650dfdbb12afb2aacb33401c. API status remains only existing package.json/yarn.lock modifications.
- Native review: high (auth surface),20paths,8433provider diff lines largely npm/pnpm generated lock conversion. Four lenses approved. Lineage review-662bac2d1cbee10a exact acknowledgement outcome native-approved-acknowledgement-completed, authority burned.
- Non-blocking review advisory R3-midnight-flake, tests/auth-dashboard.spec.cjs:124-125: test wall-clock sensitivity near midnight. Separate future test-hardening work, no correction or repeated review for approved candidate.
- Read-only ASSESS unavailable: untracked files require explicit declaration. Risk fallback unassessable/high calls for independent verifier, already satisfied above. Native closure was successful; do not claim successful assessment.
- Remaining limits: stale Browserslist warning, line-ending conversion notices, no dependency vulnerability remediation, no real Google OAuth/backend persistence or non-Windows checks. No failed required build/lint/install/browser checks remain; earlier wrapper scope failure reconciled and rerun passed.

## Next step
Committed approved frontend snapshot on master: `1e16d068d7d6d8f9094ffff1c927b31fa1a4f4fc` — `feat: add public landing and standardize frontend tooling`. Index/commit tree matches exact provider-approved `0d27a0e65e0bf6d38a0548e43897c500db0d592a`; staged diff check passed. Previous build/lint/frozen install and7browser tests cover identical source content; no new behavior writes for delivery. Passive ODD documents record source evidence in a separate docs commit. No push/API commit/Stage2; future commits follow explicit master preference. User decides when to start Stage2.
