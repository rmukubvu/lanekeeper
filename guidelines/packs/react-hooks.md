---
title: React & hooks standards
paths: ["**/*.tsx", "**/*.jsx"]
---
- Follow the Rules of Hooks: no conditional or loop-nested hook calls; exhaustive dependency arrays, with any suppression justified inline.
- Every effect that subscribes, listens, or polls must return a cleanup. Polling needs a bounded attempt count or timeout and must surface errors, never swallow them.
- Prefer the app's established data layer (query hooks) over ad-hoc fetch in useEffect.
- Don't mirror props into state; derive during render or with useMemo.
- Keys must be stable identities — never array indexes for reorderable lists.
- useMemo/useCallback only for measured problems or referential-equality needs, not by default.
- Escape hatches (direct DOM refs, dangerouslySetInnerHTML) require justification, and anything injected must be sanitized.
- Keep state in the lowest owning component; lift only when actually shared.
