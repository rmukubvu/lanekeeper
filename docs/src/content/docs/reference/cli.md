---
title: CLI reference
description: Every npm script — triage, sentinel, dashboard, demo, server — with flags and examples.
---

All commands run from the repository root and read configuration from the environment plus `.env`. Commands that analyze code are **dry runs by default**; nothing touches GitHub or chat without `--post`.

## `npm run triage`

Triage one pull request end to end.

```bash
npm run triage -- --repo owner/name --pr 123 [--post]
```

| Flag | Meaning |
|---|---|
| `--repo` | Target repository as `owner/name` (required) |
| `--pr` | Pull request number (required) |
| `--post` | Write results: labels, scorecard + walkthrough comments (upserted in place), inline suggestion review, reviewer requests, chat notifications |

Output: the scorecard, the lane decision as JSON (labels, reviewers, reasons, auto-merge eligibility), anchored inline suggestions with validation counts, and the walkthrough for large PRs. Requires `GITHUB_TOKEN`.

## `npm run sentinel`

Post-merge security scan of the default branch.

```bash
npm run sentinel -- --repo owner/name [--since <hours>] [--post]
```

| Flag | Meaning |
|---|---|
| `--repo` | Target repository (required) |
| `--since` | Lookback window in hours (default: policy `sentinel.window_hours`, 24) |
| `--post` | Open deduplicated GitHub issues for verified findings and notify chat |

Output: the scanned commit range, verified findings with evidence/explanation/fix, and the verification accounting (dropped fabrications, below-severity count).

## `npm run server`

GitHub App webhook server: triage on PR events, Sentinel on default-branch pushes, dashboard at `/`. Requires `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY(_PATH)`, `GITHUB_WEBHOOK_SECRET`. See [GitHub App](/guides/github-app/).

## `npm run dashboard` / `npm run demo`

`dashboard` serves the queue UI over your real event log on `:4400`. `demo` seeds sample events into an isolated data dir and serves that — the fastest way to see the UI. Build the frontend once first with `npm run build:web`.

## Development commands

| Command | Purpose |
|---|---|
| `npm test` | Unit tests: policy engine, diff anchoring, evidence verification, event store, JSON extraction |
| `npm run typecheck` | Backend TypeScript check (the web app typechecks during its build) |
| `npm run lint` / `npm run lint:fix` | Biome lint + format + import sorting |
| `npm run build:web` | Build the dashboard frontend to `web/dist` |
