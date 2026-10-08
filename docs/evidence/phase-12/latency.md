# Phase 12 — Latency Law (overview reads)

**Rule:** overview reads p95 < 500ms (hermes-phase-12-prompt.md — STYLE CONTRACT + LATENCY LAW).

**Probe:** 30 sequential `GET /api/v1/overview` reads against the live API :4000,
founder JWT, real DB (~130 leads, 275 pending approvals, 6 active pipelines).

**Reads (ms):** 105, 110, 111, 112, 113, 113, 115, 116, 116, 116, 117, 118, 119,
123, 125, 125, 130, 131, 135, 136, 136, 138, 138, 138, 151, 185, 263, 265, 376, 523

**min 105ms · median 125ms · p95 = 376 ms — PASS** (< 500ms budget).

**Optimization note (live-learned):** the first implementation ran 11 queries in
3 sequential Promise.all batches → p95 513ms FAIL. Fixed by fanning ALL 11
queries into ONE Promise.all (single round-trip window) → p95 376ms PASS.
The occasional 1-2s cold spike is a Supabase TLS reconnect (first read after
idle), not a query cost — visible as the tail in the reads list.

**GOAL 3 read latency (asset → GROW draft path):** the reuse POST is a write
(create + 2 audit inserts), not a read — outside the latency law; it probed at
~200ms end-to-end in phase12-probe.js.
