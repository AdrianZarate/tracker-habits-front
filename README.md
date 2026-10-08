# HabitTracker frontend

React, TypeScript and Vite frontend for creating habits, recording daily
completion and viewing history. `/` is a public Spanish introduction; Google
sign-in is at `/login`, with session-protected dashboard and habit-detail routes.

## Local setup

Use Node.js 24.20.0 and pnpm 12.8.1 (the verified toolchain). Run these commands
from this frontend directory, not the separate API project:

```sh
pnpm --version
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

Open the local URL printed by Vite. The landing is public; live sign-in and habit
data require the backend. Set `VITE_API_URL` in your local Vite environment to
the backend's base URL (default `http://localhost:3000`; match any explicit API
`PORT`). Google sign-in requires an authorized Google account and OAuth origin
configuration. Never commit credentials or local environment files.

## Reliable daily tracking

The browser detects an IANA timezone at Google login; the API persists the first
account assignment. Later devices do not silently change it. Today follows that
account zone, including daylight-saving boundaries; historical date labels are
never shifted. Missing legacy zones fall back to UTC until assigned.

Habit details load directly from their protected URLs and offer retry after
recoverable loading failures. Inactive owned habits retain readable history.
Session expiry and logout clear the stored profile and daily completion cache.
See [calendar and session behavior](docs/calendar-session.md),
[detail loading](docs/habit-details.md), and the [API guide](../api/README.md).

## Package management and script policy

- `package.json` pins `pnpm@12.8.1`; `pnpm-lock.yaml` is the frontend lockfile.
- `pnpm-workspace.yaml` sets `ignoreScripts: true`, disabling installation
  lifecycle scripts for the root project and dependencies. This is a single
  root application, not a monorepo; no package-discovery globs are needed.
- Keep `--ignore-scripts` explicit in install commands, including CI. Do not
  enable lifecycle scripts as a workaround. Explicit commands such as
  `pnpm build` and `pnpm lint` still run normally.
- Use frozen installs to reproduce the lock. Intentional dependency edits use
  `pnpm install --ignore-scripts`; review the resulting lock changes.
- The migration preserved all existing dependency ranges and application locked
  versions/integrities. It did not perform upgrades or vulnerability remediation.
  The separate API's Yarn setup is unchanged.

Confirm the effective persistent policy with `pnpm config get ignoreScripts`;
it returns `true` with the verified pnpm version.

## Checks

```sh
pnpm build
pnpm lint
pnpm preview
```

Build emits `dist/`; preview serves that production build locally. Build and lint
pass with install scripts disabled. The browser suite has 30 synthetic cases:
three landing/navigation, four session/dashboard, nine calendar/session and
fourteen detail regressions.

There is no repository test runner or new Playwright dependency. Browser checks
use an existing external Playwright/browser harness, local Vite on port 4173,
and reports outside this repository. They block real OAuth/API traffic and do
not verify live Google sign-in or backend persistence. See
[landing and browser verification](docs/public-landing.md) for the original harness
setup, plus the calendar/session and detail guides above for Stage 2 coverage.
The current session used an external `habit-tracker-core-regression` harness;
its temporary path is not a portable repository test command.
