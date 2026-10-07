# Phase 8.1 GOAL 2 — RLS Isolation Re-Probe (PASS)

Measured 2026-10-07T13:08Z (script: inline, re-runnable; needs API :4000).

```
A reads B deliverable: 404 (expect 404) ✓
A lists, B leaked: false (expect false) ✓
A overview: 200 client_id=A (scoped) ✓
Founder reads B: 200 rows=1 (override intact) ✓
Client on founder /clients: 401 (expect 401) ✓
Reuse invite: 401 (expect 401) ✓
```

All RLS isolation held after Phase 8.1 changes (gate wiring + preview routes). Client sessions rejected on founder routes and preview routes. Zero leakage.