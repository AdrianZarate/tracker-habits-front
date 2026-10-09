# Login modal visual polish

## Goal and rationale
Improve the modal shown in the user's screenshot: excessive blank header space, flat typography and a disconnected rectangular Google control. Keep the dark/indigo landing identity, add a restrained brand mark and balanced hierarchy, and integrate the official provider control without custom OAuth.

## Scope and constraints
- Presentation only: LoginModal JSX/classes, modal-scoped CSS, focused existing browser assertions and concise Spanish guide.
- Preserve native dialog focus/inert/scroll restoration, Escape/backdrop/cancel, pending/error states, duplicate/stale callbacks, captured Google credential request and session/navigation guards exactly.
- Keep GoogleLogin/idToken flow and official styling props; never style iframe contents or replace it with access-token login. No dependencies, fonts, assets, private env reads, real Google/API calls or backend edits.
- Maintain the 44px close target, provider keyboard access, contrast, reduced motion, long errors and no overflow at 320/375px. Respect official Google large-button content (40px within its 44px iframe); do not enlarge or misrepresent its native hit area. Existing 157 browser cases remain protected.
- Single scoped writer; parent owns task file/mirror/commits/review. Prior explicit master-commit authorization retained; no push or deployment. Preserve both .codegraph artifacts and original API package/yarn changes.
- Starting frontend master: 4a3738aa51c90380cad794b52a9485931efdabf3, only .codegraph untracked. Active Engram project verified as tracker-habits-front; historical records remain under habit-tracker.

## Tasks
- [x] P1 — Polish modal layout and official Google control; test responsive visual invariants and existing auth behavior. Commit `9fcc03c1a8fa96c91e63bc48224c221394e9df17`; worker checks passed.
- [x] P2 — Independent functional/image verification, review and documentation closure. Documentation work-unit `4f57998118661bf9cb1fb105256e4f7465b2e0d2`; all required functional checks passed and native approval acknowledged.

## Acceptance and checks
- Visually cohesive centered dialog with meaningful header space, restrained brand mark, readable title/subtitle and integrated provider action. No product expansion or new auth promises.
- Browser geometry/contrast/focus regression tests first where deterministic RED is meaningful; do not claim visual subjective preference as a testable guarantee.
- Existing external cached runner: node "C:/Users/adria/AppData/Local/Temp/habit-tracker-core-regression/run-regression.cjs". Synthetic GSI/API only; external logs/results/screenshots and ignored Vite caches allowed. Source/task writes paused during snapshots; require FRONTEND_SCOPE_CHANGES [], VITE_STOPPED true, PORT_4173_CLOSED.
- App/node tsc --noEmit, pnpm lint, envFile:false/build.write:false Vite bundle, git diff --check and unchanged manifests. No normal build/dev/env reads.
- Capture desktop/375/320 modal and long-error/pending views outside repo. Parent inspect representative screenshots; real Google provider appearance remains a human check because synthetic iframe does not prove it.

## Evidence and progress
2/2 closed. P1: four files +209/-24 (233 changed lines). Compact Leaf/header, indigo surface, quieter close, balanced subtitle/footer, official Google outline/pill props and modal-scoped embedding color-scheme.

- RED: three new responsive tests failed on existing 72px top padding (expected <=32). Additional embedding-scheme RED reproduced the synthetic canvas artifact. Final worker GREEN 160/160 retained all 157 existing cases. No claim that subjective aesthetics are automatically testable.
- Worker app/node noEmit, lint, env-free in-memory Vite bundle (1815 modules), diff check and manifest hashes passed; scope [], server stopped, port closed. Parent repeated diff check and read source diff plus desktop/320 screenshots; balanced layout, no visible clipping. Widget in screenshots explicitly synthetic.
- Auth implementation before JSX unchanged except Leaf import; provider credential callbacks and non-modal CSS unchanged. Actual official large Google content is 40px inside its 44px iframe; close control is 44px. No custom OAuth/iframe content styling or increased native provider hit-area claim.
- Earlier unrelated stale-account-hide/skip-link focus timeouts subsequently passed unchanged; cause not proven. Live provider/backend appearance/integration and human acceptance remain pending, independent verification/review now in P2.
- Native candidate is source work-unit commit 9fcc03c against 4a3738a, not a checkbox or accumulated feature branch.

## P2 closure evidence
- Independent final browser run: 160/160, zero skipped/failed/flaky. App/node noEmit, lint, env-free in-memory bundle (1815 modules), diff check, before/after manifest hashes all passed. Runner scope [], Vite stopped, port closed; no observed new browser/build warning.
- Native auth-hot-path high four-lens `review-b005d374c880b3d3` approved without advisories; exact acknowledgement returned authority burned. No correction, guessed verdict, cross-candidate acknowledgement or post-burn STATUS.
- ASSESS remained unassessable due preserved untracked indexes, not a passed assessment. Its high-risk independent-verifier fallback was completed; native approval remains separately observed.
- Independent source comparison confirmed pre-JSX authentication and credential callbacks unchanged apart from display import; modal-scoped CSS only. Explicit synthetic fixture drives official theme/shape; no iframe internal styling/custom OAuth/new data behavior.
- Parent inspected desktop/320 captures; independent verifier inspected 375/long-error320/pending320. Worker inspected all nine. Balanced header, readable wrapping and stable pending controls without visible clipping. Not a comprehensive accessibility audit or human aesthetic acceptance.
- External captures under Temp/habit-tracker-core-regression/results/auth-dashboard-login-polis-7365a-errors-and-pending-geometry (desktop), -6e184-errors-and-pending-geometry (375), -15c3e-errors-and-pending-geometry (320/errors/pending); full path index Temp/habit-tracker-core-regression/login-polish-handoff.txt.
- Guide verification updated to independent 160 and linked this feature in `4f57998118661bf9cb1fb105256e4f7465b2e0d2`; structural diff/readback passed. Passive documentation has no meaningful RED or new native source review; source suite evidence reused without claiming a rerun after docs.
- Protected hashes: package 439e0dea24b2dcf563eee496eab5b43bdb8a0bc0; lock d059f181c986840979dc1ed111ade4117056e4e2; workspace c6790699fab1d7a71ffdeebfce93304dacbd26f5. No dependencies/env/live API/Google/backend/CodeGraph/push/deployment. API original changes and both indexes preserved.
- Earlier unrelated stale-account-hide/skip-link timeouts passed unchanged before final worker run and did not occur in independent final run. Cause unknown; no currently failing required functional check.

## Next step and limits
User should reload and judge the actual Google widget/modal on desktop/mobile. Synthetic provider cannot validate real branding/rendering or live login/backend; live integration and human acceptance pending. No automatic product or auth-logic expansion.
