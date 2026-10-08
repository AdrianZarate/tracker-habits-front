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
the backend's base URL. Google sign-in requires an authorized Google account and
OAuth origin configuration. Never commit credentials or local environment files.

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
pass with install scripts disabled. Seven external browser regressions also pass:
three landing/navigation tests and four mocked session/dashboard tests.

There is no repository test runner or new Playwright dependency. Browser checks
use an existing external Playwright/browser harness, local Vite on port 4173,
and reports outside this repository. They block real OAuth/API traffic and do
not verify live Google sign-in or backend persistence. See
[landing and browser verification](docs/public-landing.md) for coverage and setup.
