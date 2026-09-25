/*
 * routes/cron.ts — Phase 3 monolith split (from index.ts L679–709).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { WAKE_CRON_STATES, WAKE_BRAINS } from '../cron-engine';
import { RETAINER_CRON_RUNNING } from '../retainer-cron-state';

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware } from '../ctx';
app.get('/api/v1/cron/jobs', authMiddleware, async (req, res) => {
  try {
    // Static Hermes-side jobs + the API's own in-process scheduled triggers
    const jobs = [
      { id: 'e4c4651523e2', name: 'Weekly opportunities - Monday', profile: 'research', schedule: '0 9 * * 1', enabled: true },
      { id: '0ca446d021ce', name: 'Midweek changes - Wednesday', profile: 'research', schedule: '0 10 * * 3', enabled: true },
      { id: 'a483291191ff', name: 'X daily drafts - approval required', profile: 'social', schedule: '0 14 * * *', enabled: true },
      { id: '03e95988f304', name: 'LinkedIn replies - access blocked', profile: 'social', schedule: 'interval 720m', enabled: false },
      { id: 'retainer-daily-0900', name: 'Retainer due-runs check (D2)', profile: 'orchestrator', schedule: '0 9 * * *', enabled: RETAINER_CRON_RUNNING, internal: true },
      { id: 'standup-daily-0930', name: 'Orchestrator standup (weekday 9:30)', profile: 'orchestrator', schedule: '30 9 * * 1-5', enabled: !!WAKE_CRON_STATES['standup-daily-0930'], internal: true },
      { id: 'cto-weekly-review', name: 'CTO weekly tech review (Mon 10:00)', profile: 'cto', schedule: '0 10 * * 1', enabled: !!WAKE_CRON_STATES['cto-weekly-review'], internal: true },
      { id: 'ceo-monthly-strategy', name: 'CEO monthly strategy (1st, 11:00)', profile: 'ceo', schedule: '0 11 1 * *', enabled: !!WAKE_CRON_STATES['ceo-monthly-strategy'], internal: true },
    ];
    res.json(jobs);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/cron/run/:jobId', authMiddleware, async (req, res) => {
  try {
    // Trigger job via Hermes
    res.json({ success: true, message: `Job ${req.params.jobId} triggered` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// KANBAN
// ============================================
