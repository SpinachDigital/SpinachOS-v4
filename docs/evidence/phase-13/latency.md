# Phase 13 — Latency Law (memory search reads)

**Rule:** /memory search p95 < 500ms (single hybrid query; hermes-phase-13-prompt.md STYLE CONTRACT + LATENCY LAW).

**Probe:** 30 sequential `GET /api/v1/knowledge/query?q=brand+logo&limit=10` reads
against the live API :4000, founder JWT, live index (50+ chunks, 2 RPC paths).

**Result:** min 29ms · median 39ms · **p95 = 75 ms — PASS** (< 500ms budget).

**Notes (live-learned):**
- Engine honestly degrades: when the embedding call fails, results come back
  `lexical-fallback` (tsvector) instead of empty/fake — the UI shows the
  engine name on every result line ("2 results · lexical-fallback · 365ms").
- The founder-sees-all fix (migration 071) is a predicate change only —
  same query plan, no latency cost.
- Overview reads (Phase 12) stay green: p95 376ms.
