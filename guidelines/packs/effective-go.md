---
title: Effective Go & common review standards
paths: ["**/*.go"]
---
- Wrap errors with fmt.Errorf("context: %w", err); compare with errors.Is/errors.As, never string matching.
- Never ignore returned errors — handle, wrap, or explicitly document why discarding is safe.
- context.Context is always the first parameter; never store contexts in structs; honor cancellation in loops and I/O.
- Every goroutine must have a known exit path — pair launches with cancellation, a WaitGroup, or a bounded channel; no fire-and-forget leaks.
- Guard nil receivers and nil dependencies at API boundaries; keep the zero value useful.
- defer cleanup immediately after acquiring a resource; check Close errors on writes.
- Accept interfaces, return concrete types; keep interfaces small and defined by the consumer.
- No panics across package boundaries; recover only in top-level handlers.
- Prefer table-driven tests; the race detector runs in CI.
- Don't hold locks across I/O or network calls; document which mutex protects which fields.
