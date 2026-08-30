---
title: Configuration
description: Every environment variable Lanekeeper reads, and how .env loading works.
---

All configuration is environment variables. A `.env` file in the working directory is loaded automatically by every entry point (CLI, server, dashboard, demo); **real environment variables always win** over `.env` values. `.env` is gitignored — never commit credentials.

## Model backend

| Variable | Purpose | Default |
|---|---|---|
| `LANEKEEPER_PROVIDER` | `anthropic`, `openrouter`, or `openai-compatible` | `anthropic` |
| `LANEKEEPER_MODEL` | Model ID for the chosen provider | per-provider default |
| `LANEKEEPER_MAX_OUTPUT_TOKENS` | Output cap for OpenRouter / OpenAI-compatible calls | `8192` |
| `ANTHROPIC_API_KEY` | Claude API key (an `ant auth login` profile also works) | — |
| `OPENROUTER_API_KEY` | OpenRouter key | — |
| `OPENROUTER_BASE_URL` | OpenRouter endpoint | `https://openrouter.ai/api/v1` |
| `OPENAI_COMPAT_BASE_URL` | Local/gateway endpoint, e.g. `http://localhost:11434/v1` | — |
| `OPENAI_COMPAT_API_KEY` | Key for the compatible endpoint (usually unneeded locally) | — |

See [Model providers](/guides/providers/) for full examples of each backend.

## GitHub access

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | PAT for CLI mode (`repo` read; write for `--post`) |
| `GITHUB_API_URL` | GitHub Enterprise Server API base, e.g. `https://github.example.com/api/v3` |
| `GITHUB_APP_ID` | GitHub App ID (server mode) |
| `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_PRIVATE_KEY_PATH` | App private key, inline or as a file path |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret configured on the App |

## Service & data

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | GitHub App server port | `3000` |
| `DASHBOARD_PORT` | Standalone dashboard port | `4400` |
| `LANEKEEPER_POLICY` | Local fallback policy file path | `lanekeeper.yml` |
| `LANEKEEPER_DATA_DIR` | Event log directory (JSONL) | `.lanekeeper` |
| `LANEKEEPER_WEB_DIST` | Built dashboard assets to serve | `web/dist` |

## Chat webhooks

| Variable | Platform |
|---|---|
| `TEAMS_WEBHOOK_URL` | Microsoft Teams (Workflows webhook) |
| `SLACK_WEBHOOK_URL` | Slack incoming webhook |
| `DISCORD_WEBHOOK_URL` | Discord channel webhook |

Setting a variable enables the adapter; the [policy's `notifications` section](/guides/policy/) decides which events go where.
