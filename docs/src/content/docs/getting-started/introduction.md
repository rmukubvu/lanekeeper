---
title: Introduction
description: Why Lanekeeper exists and the concepts behind it — lanes, policy as code, and the fail-safe posture.
---

AI coding agents generate pull requests faster than humans can review them. The bottleneck of software delivery has moved to the merge gate — and "review everything line by line" stopped being a plan. Lanekeeper is a control layer for that gate: it decides **how much human attention each change deserves**, explains big changes so review takes judgment instead of scrolling, turns identified risks into applyable fixes, and keeps watching the codebase after merge.

## The model scores, the policy decides

Every Lanekeeper decision follows the same two-step shape:

1. **An agent produces evidence-based, structured output** — triage scores, a walkthrough, anchored fix suggestions, security findings.
2. **Deterministic code decides what happens** — a checked-in policy picks the lane, mechanical verification accepts or rejects every anchor and citation, and fingerprints prevent duplicates.

No model output reaches your repository unchecked. This split is what makes Lanekeeper *change management* rather than another reviewer bot.

## Core concepts

### Lanes

Each pull request lands in exactly one lane:

| Lane | Meaning |
|---|---|
| `auto` | Hands-off eligible: low risk **and** only auto-eligible categories (docs, dependencies, tests by default) **and** ready **and** CI green |
| `fast` | A human should look, but briefly |
| `deep` | Full human review — high risk, protected paths, or incomplete work |

Lanes arrive as labels (`lanekeeper/lane:deep`, `lanekeeper/risk:high`), a scorecard comment on the PR, reviewer requests, and chat notifications — so the queue is visible where your team already works.

### Policy as code

Thresholds, protected paths, reviewer routing, and notification rules live in a `lanekeeper.yml` **in the repository being triaged**. Policy changes are pull requests themselves — reviewed, versioned, and auditable. See [Policy as code](/guides/policy/).

### The fail-safe posture

Failure never degrades toward "looks safe":

- If the model refuses or returns unparseable output, the PR routes to the **`deep` lane** with an explicit "no automated assessment" note.
- Inline suggestions whose anchors can't be verified against the parsed diff are **dropped, never posted**.
- Sentinel findings whose cited evidence doesn't appear verbatim in the scanned file are **discarded**.
- Auto-merge is **annotate-only**: Lanekeeper marks eligibility but performing a merge is deliberately not implemented.

A weak model can waste reviewer attention. It cannot silently wave a risky change through.

## What runs where

Lanekeeper is a TypeScript service you run yourself — as a one-shot CLI against any PR, or as a GitHub App server reacting to webhooks. Model calls go to whichever backend you configure: the Claude API, OpenRouter, or a fully local OpenAI-compatible server, so it can run with **no code leaving your network**. See [Model providers](/guides/providers/).
