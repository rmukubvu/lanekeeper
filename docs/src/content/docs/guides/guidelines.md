---
title: Team standards
description: Embed each team's coding standards — Effective Java, Go idioms, your own rules — into triage, inline review, and Sentinel.
---

Frontier models already know Effective Java, Go idioms, and the Rules of Hooks. What they can't know is **your team's** interpretation: which conventions are mandatory here, which library replaces which pattern, what the payments team forbids that the telemetry team allows. Guidelines make that explicit — natural-language standards, layered by ownership, injected into the agents only when relevant.

## Four layers, one merge

| Layer | Lives where | Owned by |
|---|---|---|
| Built-in packs | Ship with Lanekeeper: `effective-java`, `effective-go`, `react-hooks`, `owasp-top10` | Enable by name in policy |
| Org baseline | `guidelines/*.md` in a repo you name (e.g. `my-org/.lanekeeper`) | Platform / security team |
| Repo / team | `.lanekeeper/guidelines/*.md` in each governed repo | The owning team |
| Path scoping | Frontmatter globs on any guideline file | Sub-teams in monorepos |

Standards are code: they change via pull requests, `CODEOWNERS` on `.lanekeeper/` gates who edits them, and Lanekeeper triages changes to its own guidelines.

:::tip
The dashboard's **Setup** tab has an onboarding wizard that previews every built-in pack and generates a ready-to-commit `lanekeeper.yml` with your selections — see [Dashboard](/guides/dashboard/).
:::

## Writing a guideline

A guideline is a markdown file with optional frontmatter:

```markdown
---
title: Error handling
paths: ["**/*.go"]              # omit to apply to all files
applies_to: [triage, inline]    # omit for all agents (triage, inline, sentinel)
---
- Wrap errors with fmt.Errorf("context: %w", err); compare with errors.Is/As.
- Never ignore returned errors — handle, wrap, or document why discarding is safe.
- No direct DB access outside the repository layer.
```

Prose is the format on purpose — one sentence can express what a static-analysis rule would take an engineering project to encode, and the same sentence applies across languages when you want it to.

## Enabling and tuning

```yaml
guidelines:
  enabled: true
  packs: [effective-go, react-hooks, owasp-top10]
  org_repo: "my-org/.lanekeeper"   # optional org baseline
  max_chars: 6000                  # injection budget per agent per run
```

Selection is per-run and per-agent: only guidelines whose `paths` match files actually changed, and whose `applies_to` includes the running agent, are injected — a Java-only PR never pays tokens for React rules. Under a tight budget, **repo beats org beats packs**, so the most local standard always survives.

## Traceability

When a score, comment, finding, or suggestion is driven by a guideline, the agent cites its id inline:

> `ListCredentials` is keyed only by email, with no org scoping — a cross-tenant read on a console endpoint **[pack:owasp-top10]**.

The scorecard footer lists every guideline injected into the run (`Guidelines: pack:effective-go, repo:error-handling`), so a misfiring rule is visible, attributable, and one PR away from deletion. Guidelines steer emphasis and encode standards; they don't bypass any of Lanekeeper's verification — anchors and evidence are checked exactly as before.
