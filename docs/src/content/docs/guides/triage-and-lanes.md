---
title: Triage & lanes
description: How every pull request is scored, routed, labeled, and annotated.
---

When a PR opens or updates (or you run the CLI), Lanekeeper gathers the facts — title, description, author (human or bot), full per-file diffs, CI check results, existing labels — and the triage agent produces a structured assessment:

| Dimension | Meaning |
|---|---|
| `risk_score` (0–100) | Likelihood and severity of breakage: blast radius, auth/payments/migration surfaces, contract changes, test coverage, CI status, sheer size |
| `value_score` (0–100) | User/business value delivered if merged |
| `urgency_score` (0–100) | Time sensitivity (security fixes and broken-build fixes score high) |
| `blast_radius` | `isolated` · `module` · `service` · `cross_service` |
| `readiness` | `ready` · `needs_work` · `incomplete` |
| `categories` | feature, bugfix, refactor, docs, dependencies, tests, ci, security, config, other |
| `risk_factors` | Concrete reasons behind the risk score |
| `review_focus` | Ordered list of where a human should look first |
| `fix_suggestions` | Concrete remediation per material risk (concern → fix → where) |

Bot-authored PRs get extra scrutiny for unrequested behavior changes hidden in large diffs, and the agent is instructed to score risk *higher* when the diff is truncated or context is missing — never to assume unseen code is fine.

## The lane decision

Scores go into a deterministic policy engine. Rules apply in order:

1. **Protected paths** (globs in policy) touched → `deep`, always.
2. **Readiness `incomplete`** → `deep`.
3. **`auto`** if risk ≤ `lanes.auto.max_risk` **and** every category is auto-eligible **and** readiness is `ready` **and** no CI check is failing.
4. **`fast`** if risk ≤ `lanes.fast.max_risk`.
5. Otherwise **`deep`**.

A low-risk change in a non-eligible category (e.g. a risk-5 CI change) correctly lands in `fast`, not `auto` — risk alone is never sufficient for hands-off treatment.

## What lands on the PR

With `--post` (or in server mode):

- **Labels** — `lanekeeper/lane:<lane>` and `lanekeeper/risk:<low|medium|high>` (bands: ≤33, 34–66, ≥67). Stale Lanekeeper labels are replaced on re-triage; everyone else's labels are left alone.
- **The scorecard comment** — summary, score table, lane reasons, risk factors, review focus, and a *"How to reduce the risk"* section with per-concern fixes. Identified by a hidden marker and **updated in place** on every re-run — no comment spam.
- **Reviewer requests** — from the policy's glob → reviewers map, with the PR author excluded.
- **Chat notification** — per the policy's `notifications` mapping.

## Fail-safe

If the model refuses or its output fails validation, Lanekeeper substitutes a conservative assessment: risk 75, readiness `needs_work`, an explicit *"Automated triage was unavailable — routing to full human review"* summary. Broken automation degrades to human attention, never to a green light.

## Auto-merge is annotate-only

Even with `automerge.enabled: true`, an eligible PR (auto lane, not draft, CI green) is only *marked* as qualifying on the scorecard. Actually performing merges is deliberately not implemented in v1 — turning it on should be a reviewed code change made behind branch protection and a merge queue.
