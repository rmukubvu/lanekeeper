---
title: Guided walkthroughs
description: Layered explanations of large diffs, so review takes judgment instead of scrolling.
---

Agent-generated PRs are often bigger than anyone wants to read line by line. When a PR's changed lines meet the policy threshold (`explainer.min_changed_lines`, default 300), Lanekeeper generates a **guided walkthrough** and posts it as a PR comment.

## Structure

The walkthrough opens with an **Intent** paragraph — what the PR is trying to do and how the pieces fit — then organizes the changed files into semantic layers **in the order a reviewer should read them**:

1. **Contracts & schemas** — interfaces, types, API shapes, migrations, config
2. **Core logic** — the essential behavior change
3. **Integration points** — call sites, wiring, feature flags
4. **Tests** — what is and is not covered
5. **Docs & chores** — everything mechanical

Each layer names its files, what changed, the specific risks, and what the reviewer should verify. Empty layers are skipped. The walkthrough ends with **"What I could not verify"** whenever the diff was truncated or context was missing — the agent is instructed to disclose blind spots rather than paper over them.

## Behavior

- Posted as its own comment with a hidden marker, and **updated in place** on re-triage — the walkthrough evolves with the PR instead of stacking duplicates.
- On a dry run (no `--post`), the walkthrough prints to the terminal instead.
- If the model declines to analyze the change, a short "please review manually" note is used — never a fabricated summary.

## Tuning

- Raise `explainer.min_changed_lines` if small PRs don't need walkthroughs in your codebase; lower it if reviewers want them on everything.
- Walkthrough quality tracks model capability more than any other feature — a large-context model reading the full diff produces markedly better layer boundaries and risk notes than a small local model working from a truncated view. See [Model providers](/guides/providers/).
