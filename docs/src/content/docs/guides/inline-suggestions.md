---
title: Inline suggestions
description: Risks become one-click applyable GitHub suggestion blocks — with every anchor verified before posting.
---

Beyond the scorecard, Lanekeeper turns the material risks into **inline review comments on the exact diff lines**, with GitHub ` ```suggestion ` blocks the PR author can apply with one click.

## Why anchoring is the hard part

Language models are unreliable with line numbers. A suggestion posted on the wrong line is worse than no suggestion — so Lanekeeper never trusts the model's coordinates directly:

1. The diff sent to the inline-reviewer agent is **annotated with real new-file line numbers** in the gutter, so the model references lines it is actually allowed to comment on.
2. The model must **echo the exact code content** of its target line alongside the number.
3. Before posting, every proposal is checked against a parsed map of the true diff:
   - Line number and echoed content match → accepted.
   - Number drifted but the content matches **exactly one** line → relocated automatically (single-line comments only).
   - Anything else — unknown file, fabricated content, a multi-line range spanning a hunk gap, a range over 20 lines — is **dropped, never posted**.

The CLI reports the outcome on every run, e.g. `Inline suggestions: 4 anchored, 1 dropped by validation`.

## What gets posted

Accepted comments are submitted as **one PR review** (comment-only, never approve/request-changes), each entry containing the explanation, the suggestion block when a concrete fix fits, and a hidden marker. Two refinements:

- **Suggestions are optional by design.** When a proper fix needs context outside the diff — a rollout decision, a hot-path cost question — the agent leaves the suggestion empty and posts an explanation-only comment. A one-click apply would be the wrong tool there.
- **Batch with fallback.** GitHub rejects an entire review if any single anchor is invalid, so on rejection Lanekeeper retries each comment individually and drops only the genuine failures.

## Re-runs and dedupe

Re-triaging a PR skips any `path:line` that already carries a Lanekeeper inline comment, so iterating on a PR never produces duplicate suggestions. New findings on new lines are still added.

## Configuration

```yaml
inline_suggestions:
  enabled: true
  max_comments: 6   # cap per run — a few high-impact comments beat many nitpicks
```
