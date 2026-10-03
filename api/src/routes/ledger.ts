/*
 * routes/ledger.ts — Sprint 12 §2: the ledger replay API (timeline
 * filterable by agent / client / type / date; expiry honored) + the
 * founder-correction write path.
 *
 *   GET  /ledger            — replay (filters: agent, client_id, type, since, limit)
 *   GET  /ledger/stats      — counts by type/agent (the replay header)
 *   POST /ledger/correction — founder corrections (the lesson is recorded)
 */
import { app, authMiddleware, supabase } from '../ctx';
import { ledgerReplay, recordFounderCorrection } from '../memory-ledger';

app.get('/api/v1/ledger', authMiddleware, async (req, res) => {
  try {
    const { agent, client_id, type, since, limit } = req.query;
    const { entries } = await ledgerReplay(supabase, {
      agent: agent ? String(agent) : undefined,
      clientId: client_id ? String(client_id) : undefined,
      type: type ? String(type) : undefined,
      since: since ? String(since) : undefined,
      limit: limit ? parseInt(String(limit), 10) : undefined,
    });
    res.json(entries);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/ledger/stats', authMiddleware, async (_req, res) => {
  try {
    const { data } = await supabase
      .from('agent_memory')
      .select('memory_type, agent_profile, expires_at')
      .limit(2000);
    const all = data || [];
    const now = new Date().toISOString();
    const byType: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    let expired = 0;
    for (const e of all) {
      byType[e.memory_type] = (byType[e.memory_type] || 0) + 1;
      byAgent[e.agent_profile] = (byAgent[e.agent_profile] || 0) + 1;
      if (e.expires_at && e.expires_at < now) expired += 1;
    }
    res.json({ total: all.length, by_type: byType, by_agent: byAgent, expired });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/ledger/correction', authMiddleware, async (req, res) => {
  try {
    const { about, correction, reference_id } = req.body || {};
    if (!about || !String(about).trim()) return res.status(400).json({ error: 'about required' });
    if (!correction || !String(correction).trim()) return res.status(400).json({ error: 'correction required — a correction without a lesson is not a correction' });
    const ok = await recordFounderCorrection(supabase, {
      about: String(about).trim(),
      correction: String(correction).trim(),
      referenceId: reference_id || null,
    });
    if (!ok) return res.status(500).json({ error: 'ledger record failed' });
    res.status(201).json({ ok: true, recorded: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
