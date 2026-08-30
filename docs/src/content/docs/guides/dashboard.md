---
title: Dashboard
description: A GitHub-styled live queue of every triage verdict, backed by a simple append-only event log.
---

Every pipeline run — including CLI dry runs — is recorded to an append-only JSONL log and rendered as a live change queue styled after GitHub itself: underline navigation, filter bar, lane badges, an activity timeline, light/dark/system themes.

## Running it

```bash
npm run build:web    # build the React app once (output: web/dist)
npm run dashboard    # serve your real data on :4400
npm run demo         # seeded sample data — see the UI without any setup
```

In **GitHub App server mode** the same dashboard is served at `/` next to the webhook endpoint — one origin, no extra process.

## What you see

**Queue** — the latest verdict per pull request, newest first: title with bot/dry-run badges, the assessment summary, repo/author/model/when, risk-value-urgency scores (risk colored by band), and the lane badge. Filter by lane or free text (title, repo, author, category) and sort by newest, highest risk, value, or urgency.

**Activity** — a timeline of every triage run, so you can see verdicts evolve as PRs are re-triaged.

**Setup** — an onboarding wizard for governing a new repository: browse the built-in guideline packs (with rule previews served from `/api/packs`), tune lanes, protected paths, Sentinel, and notification routing, then copy a ready-to-commit `lanekeeper.yml` plus a starter team-guideline file. The wizard deliberately outputs config-as-code rather than mutating the server — policy belongs in git, and secrets (API keys, webhook URLs) stay in the server environment.

Data refreshes automatically every 15 seconds; a header button forces it.

## The event log

Events live in `LANEKEEPER_DATA_DIR` (default `.lanekeeper/events.jsonl`) — deliberately boring: append-only, greppable, no database to operate. `GET /api/events` exposes the same data as JSON (`queue` = latest per PR, `events` = recent activity) if you want to build your own views. Corrupt lines are skipped rather than breaking the dashboard, and CLI dry runs are flagged so they're distinguishable from posted verdicts.

## For UI development

The frontend is a Vite + React app in `web/` (shadcn/ui components on a GitHub Primer palette, TanStack Query + Table). `npm --prefix web run dev` starts a hot-reloading dev server with `/api` proxied to the dashboard on :4400.
