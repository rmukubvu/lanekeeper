---
title: Policy as code
description: The lanekeeper.yml reference — lanes, protected paths, reviewers, Sentinel, notifications.
---

The policy defines what the model's scores *mean* for your team. It lives in a `lanekeeper.yml` file, resolved in precedence order:

1. **`lanekeeper.yml` in the target repository's default branch** — recommended: policy travels with the code and changes via reviewed PRs.
2. A **local file** next to the service (`LANEKEEPER_POLICY`, default `./lanekeeper.yml`).
3. **Built-in defaults** (shown below).

Every field is optional; anything omitted takes its default.

```yaml
version: 1

# Lanes are decided in order: protected paths always force `deep`, then risk
# thresholds pick the widest lane the change qualifies for.
lanes:
  auto:                 # eligible for hands-off handling
    max_risk: 20
    categories: [docs, dependencies, tests]  # every PR category must be listed
  fast:                 # a human should look, but briefly
    max_risk: 45
  # everything else lands in `deep`

# Globs that always require deep human review, regardless of scores.
protected_paths:
  - ".github/workflows/**"
  - "infra/**"

# Post a guided layered walkthrough on PRs at/above this many changed lines.
explainer:
  min_changed_lines: 300

labels:
  prefix: lanekeeper    # labels look like lanekeeper/lane:deep

# Glob -> reviewers to request when matching files change (author excluded).
reviewers: {}
#  "src/api/**": [alice, bob]

# Inline review comments with one-click GitHub suggestion blocks.
inline_suggestions:
  enabled: true
  max_comments: 6

# Team & org standards injected into the agents (see the Team standards guide).
guidelines:
  enabled: true
  packs: []             # e.g. [effective-go, react-hooks, owasp-top10]
  org_repo: ""          # e.g. "my-org/.lanekeeper"
  max_chars: 6000

# Post-merge security scanning (see the Sentinel guide).
sentinel:
  enabled: true
  window_hours: 24      # CLI default lookback
  max_files: 30
  min_severity: medium  # don't open issues below this
  paths: []             # optional focus globs; empty = all changed files

# Auto-merge only ever annotates eligibility in v1.
automerge:
  enabled: false

# Which chat adapters get notified per event (teams | slack | discord).
notifications:
  deep: [teams]
  fast: [teams]
  auto: []
  sentinel: [teams]
```

## Notes

- **`lanes.auto.categories` is a conjunction**: *every* category the triage assigned must be in the list. A PR tagged `docs, feature` is not auto-eligible under the default policy.
- **`protected_paths` and `sentinel.paths`** use [minimatch](https://github.com/isaacs/minimatch) globs with dotfiles matched (`.github/**` works).
- **`notifications`** keys are the lane names plus `sentinel`; values are adapter names. An adapter must also have its webhook URL configured to actually send.
- Policy is validated with defaults on load — a partial file is fine; an invalid one fails loudly rather than being silently ignored.
