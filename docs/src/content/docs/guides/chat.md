---
title: Chat notifications
description: Native Teams, Slack, and Discord notifications from one neutral card model.
---

Lanekeeper renders one platform-neutral "change card" natively per platform — an Adaptive Card in Teams, Block Kit in Slack, an embed in Discord. Cards carry the PR (or Sentinel scan), lane and risk, author, size, readiness, and a summary, with severity coloring and a link to the PR or issue list.

## Setup

Each adapter is enabled by a single incoming-webhook URL:

| Platform | What to create | Env var |
|---|---|---|
| **Microsoft Teams** | Channel → Workflows → *"Post to a channel when a webhook request is received"* (the Power Automate successor to the retired Office 365 connectors) | `TEAMS_WEBHOOK_URL` |
| **Slack** | An incoming webhook (api.slack.com/apps → Incoming Webhooks) | `SLACK_WEBHOOK_URL` |
| **Discord** | Channel settings → Integrations → Webhooks | `DISCORD_WEBHOOK_URL` |

## Routing

The policy decides which events reach which platforms:

```yaml
notifications:
  deep: [teams]        # deep-lane PRs ping Teams
  fast: [teams]
  auto: []             # auto-lane changes stay quiet
  sentinel: [teams]    # new post-merge findings
```

Notifications only fire on posted runs (`--post` or server mode), never on dry runs. A failing webhook is logged and never blocks the pipeline or the other platforms.

## Adding a platform

Adapters implement one interface — `name` plus `send(card)` — in `src/chat/`. The card model (title, subtitle, URL, facts, body, severity) is already platform-neutral, so a new integration is typically under fifty lines. This is also the seam where a richer two-way Teams bot (Bot Framework) will plug in.
