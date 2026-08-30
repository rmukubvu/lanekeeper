# 🛣️ Lanekeeper

Agentic change management for GitHub. As AI coding agents generate more pull requests than humans can read, the merge gate becomes the bottleneck — Lanekeeper puts a control layer in front of it:

- **Triage** — every PR is assessed by Claude (risk, value, urgency, blast radius, readiness) and routed into a **lane**: `auto`, `fast`, or `deep`.
- **Policy as code** — a checked-in `lanekeeper.yml` decides what the scores *mean*: lane thresholds, protected paths that always need humans, reviewer routing, notification rules. The model scores; deterministic policy decides.
- **Guided walkthroughs** — large diffs get a layered explanation (contracts → core logic → integration points → tests) posted as a PR comment, so reviewers read with judgment instead of scrolling.
- **Inline fix suggestions** — the identified risks become inline review comments with GitHub ` ```suggestion ` blocks on the exact diff lines, one click to apply. Every anchor is verified deterministically against the parsed diff before posting; anything misanchored is dropped, never posted.
- **Chat adapters** — one neutral card model, rendered natively per platform: **Microsoft Teams** (Adaptive Cards), **Slack** (Block Kit), **Discord** (embeds). Adding a platform = implementing one interface ([src/chat/types.ts](src/chat/types.ts)).

Works with github.com and GitHub Enterprise Server (set `GITHUB_API_URL`).

## How it flows

```
GitHub webhook (PR opened/updated)          npm run triage -- --repo o/r --pr N
                └──────────────┬──────────────────────┘
                        gather facts          (diff, CI, labels, author)
                        resolve policy        (repo lanekeeper.yml → local → defaults)
                        triage agent          (Claude → structured scores)
                        policy engine         (deterministic lane decision)
                 ┌─────────────┼──────────────────┐
            labels + scorecard  walkthrough   chat notification
            comment on the PR   (large PRs)   (Teams/Slack/Discord)
```

## Quick start (no infrastructure)

Dry-run triage against any PR you can read — nothing is written anywhere:

```bash
npm install
export GITHUB_TOKEN=ghp_...            # and ANTHROPIC_API_KEY, or `ant auth login`
npm run triage -- --repo owner/name --pr 123
```

Add `--post` to write the labels + scorecard comment to the PR and notify configured chat channels.

## Server mode (GitHub App)

1. Create a GitHub App (org settings → Developer settings → GitHub Apps):
   - Permissions: **Pull requests: read/write**, **Contents: read**, **Checks: read**, **Issues: read/write**.
   - Subscribe to **Pull request** events. Webhook URL: `https://<host>/api/github/webhooks`.
2. Copy `.env.example` to `.env`, fill in `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY_PATH`, `GITHUB_WEBHOOK_SECRET`.
3. `npm run server`

## Model providers

The pipeline talks to models through one small interface ([src/providers/types.ts](src/providers/types.ts)), so the backend is a config choice:

| `LANEKEEPER_PROVIDER` | Backend | Notes |
|---|---|---|
| `anthropic` (default) | Claude API via official SDK | Best quality; server-validated structured outputs; default model `claude-opus-5` |
| `openrouter` | OpenRouter | One key, hundreds of models; vendor-prefixed names, e.g. `LANEKEEPER_MODEL=anthropic/claude-opus-5` |
| `openai-compatible` | Any `/v1/chat/completions` server | Ollama, LM Studio, vLLM, or an enterprise LLM gateway — set `OPENAI_COMPAT_BASE_URL` + `LANEKEEPER_MODEL` |

Example — fully local with Ollama (nothing leaves the machine):

```bash
export LANEKEEPER_PROVIDER=openai-compatible
export OPENAI_COMPAT_BASE_URL=http://localhost:11434/v1
export LANEKEEPER_MODEL=qwen3:32b
npm run triage -- --repo owner/name --pr 123
```

For non-Anthropic backends, Lanekeeper requests `response_format: json_schema`, embeds the schema in the prompt as a belt-and-braces measure, falls back automatically if the server rejects `response_format`, and always validates the result locally with zod. Anything that still fails validation triggers the fail-safe (deep lane, human review) — a weak model can waste attention, but it can never silently mark a change low-risk. Expect triage calibration to vary with model quality; small local models are fine for demos, less so for production gatekeeping.

## Dashboard

Every triage run (including CLI dry runs) is recorded to an append-only JSONL log and rendered as a live change queue styled after GitHub itself — underline nav, filter bar, lane badges, an activity timeline, light/dark themes.

The UI is a React app in [web/](web/) built with **shadcn/ui** (Radix primitives, GitHub Primer palette mapped onto shadcn's design tokens), **TanStack Query** (polling) + **TanStack Table** (sorting/filtering), and formatted/linted with **Biome**.

```bash
npm run build:web   # build the UI once (output: web/dist, served by the Node server)
npm run demo        # seed sample data + serve the dashboard on :4400
npm run dashboard   # dashboard over your real data (.lanekeeper/)
```

In server mode the same dashboard is served at `/` next to the webhook endpoint. `/api/events` exposes the raw JSON. For UI development, `npm --prefix web run dev` starts Vite with `/api` proxied to :4400. Without a build, the server falls back to a minimal server-rendered page.

## Chat setup

| Platform | What to create | Env var |
|---|---|---|
| Teams | Channel → Workflows → "Post to a channel when a webhook request is received" | `TEAMS_WEBHOOK_URL` |
| Slack | Incoming webhook (api.slack.com/apps) | `SLACK_WEBHOOK_URL` |
| Discord | Channel settings → Integrations → Webhooks | `DISCORD_WEBHOOK_URL` |

Which lanes ping which platforms is controlled by `notifications:` in the policy file.

## Policy

See [lanekeeper.example.yml](lanekeeper.example.yml) for the annotated reference. Precedence: `lanekeeper.yml` in the target repo's default branch → local file (`LANEKEEPER_POLICY`) → built-in defaults.

Two safety properties are deliberate:

- **Fail-safe triage**: if the model refuses or returns something unparseable, the PR is routed to the `deep` lane with an explicit "no automated assessment" note — never silently marked low-risk.
- **No unattended merges**: `automerge.enabled` only ever *annotates* eligibility in v1. Wiring an actual merge (behind branch protection + merge queue) is an explicit code change in [src/pipeline.ts](src/pipeline.ts).

## Configuration

| Env var | Purpose |
|---|---|
| `LANEKEEPER_PROVIDER` | `anthropic` (default), `openrouter`, or `openai-compatible` |
| `LANEKEEPER_MODEL` | Model ID (per-provider default when unset) |
| `ANTHROPIC_API_KEY` | Claude API key (or use an `ant auth login` profile) |
| `OPENROUTER_API_KEY` / `OPENROUTER_BASE_URL` | OpenRouter provider |
| `OPENAI_COMPAT_BASE_URL` / `OPENAI_COMPAT_API_KEY` | Local/gateway provider (Ollama, LM Studio, vLLM) |
| `LANEKEEPER_MAX_OUTPUT_TOKENS` | Output cap for non-Anthropic providers (default 8192) |
| `LANEKEEPER_DATA_DIR` / `DASHBOARD_PORT` | Event log location (`.lanekeeper`) and dashboard port (4400) |
| `GITHUB_TOKEN` | PAT for CLI mode |
| `GITHUB_API_URL` | GitHub Enterprise Server API base, e.g. `https://github.example.com/api/v3` |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY(_PATH)` / `GITHUB_WEBHOOK_SECRET` | GitHub App (server mode) |
| `TEAMS_WEBHOOK_URL` / `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` | Chat adapters |

## Development

```bash
npm run typecheck   # backend (web/ typechecks during its build)
npm test            # policy engine, provider JSON handling, event store
npm run lint        # Biome: lint + format check + import sorting
npm run lint:fix    # Biome with safe autofixes
```

## Roadmap

- **Sentinel**: scheduled post-merge pass over recently changed areas (security/data-flow focus), opening issues with proposed fixes.
- **History & trends**: charts over the recorded events — lead time per lane, risk over time, agent vs. human share.
- **Reviewer-fit learning**: seed reviewer routing from git blame/CODEOWNERS instead of static globs.
- **Two-way Teams bot**: Bot Framework app so reviewers can act (approve lane change, request walkthrough) from the card.

## Origin note

Lanekeeper is an independent, clean-room implementation of the emerging "change management for AI-generated code" pattern, built only from first principles and publicly available descriptions of the problem space. It shares no code, branding, or internal knowledge with any commercial product.
