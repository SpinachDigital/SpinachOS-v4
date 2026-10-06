# Phase 7-FIX FIX 7 — Latency Evidence

Measured 2026-10-06T21:08:07.779Z against the live API (localhost:4000).

- Card-create p50 (POST /api/v1/approvals, lint wired): **117 ms**
- Card-create p95: **192 ms**
- lintAgentOutput p50 (local, the marginal cost FIX 4 adds): **0.014 ms**
- lintAgentOutput p95: **0.031 ms**
- Budget: <500 ms overhead on the hot path → **HELD** (lint p95 0.031 ms << 500 ms)
- Cards created in probe: 5; carrying style_score in DB: 5

Method: 5 real card POSTs through the wired path + 200 local lint iterations.
Script: api/scripts/phase7fix-latency-probe.js (re-runnable).
