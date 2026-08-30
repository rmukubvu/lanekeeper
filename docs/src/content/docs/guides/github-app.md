---
title: GitHub App (server mode)
description: Run Lanekeeper continuously — triage on every PR event, Sentinel on every push to the default branch.
---

CLI mode is perfect for trying Lanekeeper and for one-off runs. Server mode makes it ambient: a GitHub App delivers webhooks, and Lanekeeper reacts to every pull request and every merge without anyone typing a command.

## Create the App

In your org (or user) settings → **Developer settings → GitHub Apps → New GitHub App**:

- **Webhook URL**: `https://<your-host>/api/github/webhooks`
- **Webhook secret**: generate one; you'll set it as `GITHUB_WEBHOOK_SECRET`
- **Repository permissions**:
  - Pull requests: **Read and write** (labels, comments, reviews, reviewer requests)
  - Issues: **Read and write** (Sentinel findings)
  - Contents: **Read** (diffs, file contents, `lanekeeper.yml`)
  - Checks: **Read** (CI status feeds the lane decision)
- **Subscribe to events**: **Pull request** and **Push**
- Generate a **private key** and note the **App ID**, then **install** the App on the repositories you want governed.

## Configure and run

```bash
# .env
GITHUB_APP_ID=123456
GITHUB_APP_PRIVATE_KEY_PATH=./lanekeeper.private-key.pem
GITHUB_WEBHOOK_SECRET=...
PORT=3000
# plus your model provider variables
```

```bash
npm run build:web   # once, so the dashboard is served
npm run server
```

## What the server does

| Event | Action |
|---|---|
| PR opened / reopened / synchronized / ready for review | Full triage pipeline, posted: labels, scorecard, walkthrough, inline suggestions, reviewers, chat |
| Push to the **default branch** | Sentinel scan of exactly that `before...after` range; verified findings become issues |
| Draft PRs | Skipped until marked ready |

The server also serves the [dashboard](/guides/dashboard/) at `/`, the event API at `/api/events`, and a health check at `/healthz`. Per-repo behavior — lanes, protected paths, Sentinel settings — comes from each repository's own `lanekeeper.yml`, so one server instance can govern many repos with different rules.

## GitHub Enterprise Server

Set the API base URL and everything — App auth, webhooks, API calls — targets your GHES instance:

```bash
GITHUB_API_URL=https://github.example.com/api/v3
```

Combined with a [local model provider](/guides/providers/), this runs Lanekeeper entirely inside your network.
