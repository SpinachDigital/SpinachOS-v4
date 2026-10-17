/*
 * routes/models.ts — Phase 3 monolith split (from index.ts L251–286).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, supabase } from '../ctx';
import { getBreakerStates, getFallbackLog } from '../bridge';
app.get('/api/v1/profiles', authMiddleware, async (_req, res) => {
  try {
    // P1 Task 6: all 10 real profiles, live vs dormant marked explicitly.
    // model = what the profile's gateway calls actually use; fallback_model =
    // the tiered route every gateway call degrades to; provider = OmniRoute today.
    // NIM sweep (2026-10-16): combo/spinach-agents-v2 = super-120b → super-vl
    // → agy/gemini → openrouter/free. Specialist depts ride super-vl direct.
    const defaults: Record<string, string> = {
      ceo: 'combo/spinach-agents-v2',
      cto: 'combo/spinach-agents-v2',
      orchestrator: 'combo/spinach-agents-v2',
      designer: 'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b',
      engineer: 'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b',
      social: 'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b',
      seo_specialist: 'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b',
      research: 'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b',
      sales: 'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b',
      ads_manager: 'nvidia/nvidia/nemotron-3.5-super-vl-120b-a12b',
    };
    // DB picks win over the hardcoded defaults — the Settings picker writes
    // these, so the UI must reflect them (bug: UI showed the stale hardcoded
    // combo for every profile).
    const { data: picks } = await supabase
      .from('department_model_picks')
      .select('department, model')
      .in('department', Object.keys(defaults));
    const pickMap = new Map((picks || []).map((p: any) => [p.department, p.model]));
    const names: Record<string, string> = {
      ceo: 'CEO', cto: 'CTO', orchestrator: 'Orchestrator', designer: 'Designer',
      engineer: 'Engineer', social: 'Social', seo_specialist: 'SEO', research: 'Research',
      sales: 'Sales', ads_manager: 'Ads Manager',
    };
    const dormantSet = new Set(['ads_manager']);
    const profiles = Object.keys(defaults).map((id) => {
      const model = pickMap.get(id) || defaults[id];
      return {
        id,
        name: names[id],
        model,
        fallback_model: defaults[id],
        provider: 'omniroute',
        status: dormantSet.has(id) ? 'dormant' : 'live',
        dormant: dormantSet.has(id),
      };
    });
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
