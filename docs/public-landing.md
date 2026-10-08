# Public landing and browser verification

The public landing and existing session/dashboard flows are covered by seven
passing browser regressions. Full frontend build and lint now pass after the
technical closure and pnpm migration; the earlier blockers are resolved.

## Delivered surface

`/` is a public Spanish introduction. All three sign-in calls to action lead to
`/login`. Google login, protected dashboard/habit routes and wildcard redirect
retain their existing behavior. The dashboard preview is static, explicitly
labelled as illustrative and contains only sample habits and completion records.

The page uses semantic landmarks, a keyboard skip link, visible link focus,
responsive grids and existing Tailwind/lucide dependencies. Document metadata is
Spanish and the favicon is the local `public/habit-tracker.svg`.

## Local checks

Use pnpm 12.8.1 from the frontend directory:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm lint
```

All three commands passed after migration. `pnpm-workspace.yaml` persists
`ignoreScripts: true`; `pnpm config get ignoreScripts` returns `true`. Installation
lifecycle scripts remain disabled for root and dependencies. See the
[setup guide](../README.md) for the backend environment and development server.

## External browser harness

The specs target local Vite at `http://127.0.0.1:4173`. Use an existing external
Playwright installation and browser; neither is a new repository dependency.
Configure the harness to select both specs below, make Playwright resolvable by
them, and keep its config, reports and screenshots outside the repository.
Start Vite with `pnpm exec vite --host 127.0.0.1 --port 4173 --strictPort`, or let
the existing harness manage that server. Do not start a second server on the port.

| Spec | Tests | Coverage |
|------|-------|----------|
| `tests/landing.spec.cjs` | 3 | Public root, benefits, labelled preview, steps, login links, metadata/favicon, 320/375/768/1440px overflow, skip/keyboard navigation, signed-out protected/wildcard routes |
| `tests/auth-dashboard.spec.cjs` | 4 | No-token redirects without API requests; stored-session validation/renewal/restore/logout; rejected-session cleanup; initial habits/logs enrichment and post-create refresh |

The landing spec allows only local static GETs. The auth/dashboard fixture
fulfills bounded API requests with synthetic data, including the creation POST;
it never forwards that write to a backend. External OAuth and unhandled API
requests are blocked. The combined existing harness passed all seven tests with
no frontend file changes, stopped Vite and confirmed port 4173 was closed.

## Verification limits

The original one-test baseline harness checks only the public root URL, heading
and login link; it is not the combined regression suite or a visual-polish check.
The browser specs check UI behavior against mocks, not real Google OAuth,
backend persistence or every platform's native tooling. Live authentication and
API behavior still require separate human verification. Build's outdated
Browserslist-data warning is not a failure; dependency audit remediation was not
part of this migration.
