# Phase 10 — calendar latency (p95)
# Probe: api/scripts/phase10-loop-probe.js (10 sequential GET /api/v1/grow/calendar reads)
# Run 2026-10-08: 37,65,70,74,88,90,97,98,107,222 ms → p95 = 222ms (10th of 10)
# Budget: p95 < 500ms — PASS (222ms < 500ms)
# Full log (loop probe run with mock provider live):
#   1. create: 201 63fed681-3a0e-43aa-a13b-432d9ef08d33
#   2. generate: 200 score: 10 card: 69e8d442-8d71-43f2-9cf3-0e3fd1bb588e
#   3. approve: 200
#   4. schedule (past): 200
#   5. scheduler published: published mock-1791475541407
#   6. ledger latest: [{ agent: grow, key: publish:63fed681-…, value: content publish }]
#   7. calendar latency ms (10 reads): 37,65,70,74,88,90,97,98,107,222 p95: 222
#   cleaned (mock removed, publora reactivated)
