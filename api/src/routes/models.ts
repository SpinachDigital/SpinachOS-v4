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
    // gateway calls actually use); fallback_model = the tiered auto/* route
    // every gateway call degrades to; provider = OmniRoute today.
    const profiles = [
      { id: 'ceo',            name: 'CEO',           model: 'auto/pro-reasoning', fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'cto',            name: 'CTO',           model: 'auto/pro-reasoning', fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'orchestrator',   name: 'Orchestrator',  model: 'auto/pro-reasoning', fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'designer',       name: 'Designer',      model: 'auto/best-chat',     fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'engineer',       name: 'Engineer',      model: 'auto/pro-coding',    fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'social',         name: 'Social',        model: 'auto/best-fast',     fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'seo_specialist', name: 'SEO',           model: 'auto/best-reasoning', fallback_model: 'auto/best-fast', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'research',       name: 'Research',      model: 'auto/best-reasoning', fallback_model: 'auto/best-fast', provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'sales',          name: 'Sales',         model: 'auto/best-fast',     fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'live',    dormant: false },
      { id: 'ads_manager',    name: 'Ads Manager',   model: 'auto/pro-reasoning', fallback_model: 'auto/best-fast',  provider: 'omniroute', status: 'dormant', dormant: true },
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
