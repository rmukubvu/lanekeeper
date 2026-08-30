---
title: Architecture & guarantees
description: How the pieces fit, and the invariants that keep model output from reaching your repo unchecked.
---

## The flow

```
GitHub webhook (PR opened/updated)          npm run triage -- --repo o/r --pr N
                └──────────────┬──────────────────────┘
                        gather facts          diff, CI checks, labels, author
                        resolve policy        repo lanekeeper.yml → local → defaults
                        triage agent          structured scores + fix suggestions
                        policy engine         deterministic lane decision
                        inline reviewer       anchored, verified suggestions
                 ┌─────────────┼──────────────────┬─────────────────┐
            labels + scorecard  walkthrough   inline review     chat cards
            (upserted comment)  (large PRs)   (suggestion       (Teams/Slack/
                                               blocks)           Discord)

push to default branch ──→ Sentinel: full-file security scan → verified,
                           deduplicated GitHub issues + chat summary
```

Every run is appended to the event log that powers the [dashboard](/guides/dashboard/).

## Components

| Piece | Job |
|---|---|
| Triage agent | Structured assessment: scores, categories, risk factors, review focus, fix suggestions |
| Policy engine | Pure function from (facts, assessment, policy) → lane, labels, reviewers, notifications |
| Explainer agent | Layered walkthrough for large diffs |
| Inline reviewer | Proposals for line-anchored fixes, mechanically verified before posting |
| Sentinel | Post-merge security scan with full-file context and evidence verification |
| Providers | Anthropic / OpenRouter / OpenAI-compatible behind one interface |
| Chat adapters | One card model, native rendering per platform |
| Event store | Append-only JSONL feeding the dashboard and `/api/events` |

## The guarantees

These invariants hold regardless of which model backend is configured:

1. **No unchecked model output reaches the repo.** Inline-suggestion anchors are validated against the parsed diff; Sentinel evidence must appear verbatim in the scanned file; structured outputs are schema-validated locally. Failures are dropped, never posted.
2. **Failure degrades to human attention.** A refusal or unparseable assessment routes the PR to the `deep` lane with an explicit note — never to a favorable score.
3. **No unattended merges.** Auto-merge eligibility is annotate-only; performing merges is intentionally unimplemented in v1.
4. **Idempotent re-runs.** Scorecard and walkthrough comments are upserted via hidden markers; inline comments dedupe per `path:line`; Sentinel issues dedupe by evidence fingerprint. Re-triaging is always safe.
5. **Policy is deterministic and yours.** Lane routing, protected paths, severity floors, and notification fan-out are plain code over a reviewed, versioned YAML file — the model never decides what *happens*, only what it *observed*.

## Comment markers and labels

Lanekeeper identifies its own artifacts with hidden HTML markers and namespaced labels:

| Artifact | Identifier |
|---|---|
| Scorecard comment | `<!-- lanekeeper:scorecard -->` |
| Walkthrough comment | `<!-- lanekeeper:walkthrough -->` |
| Inline comments | `<!-- lanekeeper:inline -->` |
| Sentinel issues | `<!-- lanekeeper:sentinel:<fingerprint> -->` |
| PR labels | `lanekeeper/lane:*`, `lanekeeper/risk:*` |
| Issue labels | `lanekeeper/sentinel`, `lanekeeper/severity:*` |

Only labels under the configured prefix are ever replaced; everything else on the PR is left untouched.
