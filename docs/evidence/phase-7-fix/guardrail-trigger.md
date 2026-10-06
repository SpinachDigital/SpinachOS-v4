# Phase 7-FIX FIX 2 — Cost Guardrail Live Trigger Evidence

Measured 2026-10-06T21:23Z (script: `api/scripts/probe-guardrail.ts`, re-runnable).

```
1. cost_cap rule seeded: 6a490d56-ef58-4af2-b50f-27c01160e853
2. guardrail check: cost_usd=0.0034 cap_usd=0.00001 breached=true
3. ledger trigger row: [{"id":"679aaffa-ac64-4d3d-a25c-d6709a4d4006","key":"cost_breach:6a490d56-ef58-4af2-b50f-27c01160e853","created_at":"2026-10-06T21:23:07.985887+00:00"}]
4. guardrail card: [{"id":"7dff0ae0-5a40-4a80-bf51-f885587ebb63","title":"AI spend crossed cap — @latency-probe","status":"pending","type":"cost_guardrail"}]
5. probe rows cleaned (ledger trigger row kept as evidence)
```

**Chain:** approved `cost_cap` rule (learned_preferences) → `checkCostCap()` on the spend path (wired in `usage.ts:logUsage`, 60s cache) → breach → Company Memory Ledger trigger row (`agent_memory`, key `cost_breach:<rule_id>`) + low-risk inbox card (`approvals`, type `cost_guardrail`).

**Wiring:** `api/src/usage.ts:15` imports `checkCostCap` from `api/src/cost-guardrails.ts`; called at `usage.ts:85` after cost is computed, before the usage row returns. The trigger line carries timestamp + agent + rule id per spec.
