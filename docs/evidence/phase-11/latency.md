# Phase 11 — Latency Law (lead list + filtered reads)

**Rule:** lead list/detail p95 < 500ms (hermes-phase-11-prompt.md — STYLE CONTRACT + LATENCY LAW).

**Probe:** `api/scripts/phase11-batch-latency.js` — 20 sequential reads
(`GET /api/v1/leads?status=new` and `?status=qualified`, 10 rounds each),
live API :4000, real DB rows (~130 leads).

**Reads (ms):** 24, 24, 26, 27, 28, 29, 30, 32, 32, 32, 33, 34, 34, 34, 35, 40, 46, 52, 57, 99

**p95 = 57 ms — PASS** (< 500ms budget, ~9x headroom).

Note: `qualify-batch` (LLM call per lead, serial) took ~105s for 10 leads —
that is an agent-generation path, not a read; the latency law applies to list
reads. The batch is rate-limited (2 runs/hour) precisely because it is costly.
