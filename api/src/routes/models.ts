/*
 * routes/models.ts — Phase 3 monolith split (from index.ts L251–286).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware } from '../ctx';
import { getBreakerStates, getFallbackLog } from '../bridge';
app.get('/api/v1/profiles', authMiddleware, async (_req, res) => {
  try {
    // P1 Task 6: all 10 real profiles, live vs dormant marked explicitly.
    // model = the bridge's GATEWAY_MODEL_BY_PROFILE (the model the profile's
    // gateway calls actually use); fallback_model = the tiered route every
    // gateway call degrades to; provider = OmniRoute today.
    // Phase 13 routing fix: all profiles ride combo/spinach-agents (tested
    // 200 priority chain) — the auto/* slugs hung via the noauth opencode
    // connection. The per-dept DB pick still overrides at call time.
    const profiles = [
      { id: 'ceo',            name: 'CEO',           model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'cto',            name: 'CTO',           model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'orchestrator',   name: 'Orchestrator',  model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'designer',       name: 'Designer',      model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'engineer',       name: 'Engineer',      model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'social',         name: 'Social',        model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'seo_specialist', name: 'SEO',           model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'research',       name: 'Research',      model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'sales',          name: 'Sales',         model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'ads_manager',    name: 'Ads Manager',   model: 'combo/spinach-agents', fallback_model: 'combo/spinach-agents', provider: 'omniroute', status: 'dormant', dormant: true },
    ];
    res.json(profiles);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// P1 Task 4 — circuit-breaker telemetry (per-provider state)
app.get('/api/v1/models/breakers', authMiddleware, (_req, res) => {
  res.json(getBreakerStates());
});

// P1 Task 5 — fallback event log (from → to, reason, timestamp)
app.get('/api/v1/models/fallback-log', authMiddleware, (_req, res) => {
  res.json(getFallbackLog());
});

// ============================================
// CHAT / AGENT EXECUTION
