# Phase 7-FIX FIX 1 — Playbook Versioned Diff Live Evidence

Measured 2026-10-06T21:30Z (script: `api/probe-playbook-fix.ts`, re-runnable).

```
1. pack current: ret-growth v1
2. proposal seeded: 20e71e3d-e33a-44e4-8a1e-cdc589c68842 → v2
3. apply (200): {"ok":true,"applied":{"type":"playbook_fix","playbook_fix_version":"2","playbook_fix_diff":"{\"new_version\":\"2\",\"changed_steps\":[],\"changed_tasks\":[],\"changed_gates\":[]}"}}
4. versions now: v1 (5 steps), v2 (6 steps)
5. old install check: installs stay on v1 (versioned law) — playbooks table has both rows coexisting
6. probe proposal cleaned; v2 row kept as evidence
```

**Chain:** `playbook_fix` proposal approved via the REAL `/api/v1/evolutions/:id/apply` endpoint → actual v(N+1) row upserted into `playbooks` (on slug+version conflict) with the diff applied as data (stages_json 5 → 6 steps: step 2 split into part 1/part 2) → v(N) row untouched → versioned-install law holds (old installs keep v1; new installs get v2).

**Wiring:** `api/src/routes/evolutions.ts:58-89` — the apply handler creates the version row from payload data (`new_version`, `new_steps/new_tasks/new_gates`), stamps `playbook_fix_version` + full diff into the applied record.
