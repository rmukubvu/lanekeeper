---
title: Sentinel post-merge scans
description: Continuous security review of what actually landed, with full-file context and evidence-verified findings.
---

Pre-merge review sees a diff. **Sentinel re-examines what actually merged**, with the full current content of every changed file — the context in which a change can turn dangerous. It looks for what PR review characteristically misses:

- Authorization and **tenant-isolation** boundaries
- Injection (SQL, command, template, path)
- **Secrets or credentials** in code or exposed via process arguments
- Weak or misused crypto
- Sensitive data exposed via logs, API responses, or traces
- SSRF and unvalidated URLs or redirects
- Denial of service — unbounded loops, polling without backoff, unbounded allocation
- Supply-chain risk and **dangerous defaults or silent fallbacks**

## Running it

**Server mode** — every push to the default branch triggers a scan of exactly that `before...after` commit range, automatically. (Subscribe the GitHub App to **Push** events.)

**CLI** — scan a time window on demand:

```bash
npm run sentinel -- --repo owner/name --since 24          # dry run, hours
npm run sentinel -- --repo owner/name --since 24 --post   # file issues + notify
```

The window resolves to commits on the default branch; their combined change set is compared, current file contents are fetched (capped by `max_files` and a total size budget), and the security agent analyzes diff + content together.

## Evidence or it didn't happen

Every finding must include the offending code **copied verbatim** into its `evidence` field. Lanekeeper verifies mechanically — whitespace-normalized — that the evidence actually appears in the scanned file. Fabricated or drifted citations are discarded before anything is filed. The CLI shows the accounting:

```
Findings: 2 verified · 0 dropped (evidence not found) · 1 below min severity
```

An empty findings list is an explicitly good outcome; the agent is instructed that fewer, well-founded findings beat volume, and that saying nothing beats speculating about unseen code.

## Issues, dedupe, and notifications

With `--post` (or in server mode), each verified finding at or above `sentinel.min_severity` becomes a GitHub issue:

- Titled `[Sentinel] <finding title>`, labeled `lanekeeper/sentinel` and `lanekeeper/severity:<level>`.
- Body contains severity/category/confidence, the evidence block, why it matters, the recommended fix, and the scanned commit range.
- **Fingerprint-deduplicated**: a hash of file + category + normalized evidence is embedded in each issue, and open issues are checked before filing — repeated or overlapping scans never double-file the same finding.

When new issues open, a summary card (severity counts, top findings, link to the issue list) goes to the chat adapters named under `notifications.sentinel`.

## Configuration

```yaml
sentinel:
  enabled: true
  window_hours: 24      # CLI default lookback
  max_files: 30
  min_severity: medium  # critical | high | medium | low
  paths: []             # focus globs, e.g. ["src/payments/**"]; empty = everything
```
