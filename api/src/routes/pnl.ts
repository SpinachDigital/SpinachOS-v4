/*
 * routes/pnl.ts — Sprint 11 §2: the P&L view (one clear page — observability
 * not accounting). Per-client: "AI me ₹X padta hai, ₹Y deta hai, margin Z%".
 * Revenue = the client's monthly_value field (manual input, honest — never
 * invented). Per-agent rollup (which agent burns the most) + per-model
 * breakdown. Every number traces to a usage_logs row.
 *
 * Endpoints:
 *   GET  /pnl              — full rollup (clients + agents + models + totals)
 *   POST /pnl/revenue      — set a client's monthly_value (manual, honest)
 *   GET  /pnl/unpriced     — models with usage but no rate (the gap, visible)
 */
import { app, authMiddleware, supabase } from '../ctx';
import { pnlRollup } from '../usage';

app.get('/api/v1/pnl', authMiddleware, async (_req, res) => {
  try {
    const rollup = await pnlRollup(supabase);
    res.json(rollup);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/pnl/revenue', authMiddleware, async (req, res) => {
  try {
    const { client_id, monthly_value } = req.body || {};
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    if (monthly_value == null || isNaN(Number(monthly_value)) || Number(monthly_value) < 0) {
      return res.status(400).json({ error: 'monthly_value (number ≥ 0) required — manual input, never invented' });
    }
    const { data, error } = await supabase
      .from('clients')
      .update({ monthly_value: Number(monthly_value), updated_at: new Date().toISOString() })
      .eq('id', client_id)
      .select('id, name, monthly_value')
      .single();
    if (error) throw error;
    res.json({ ok: true, client: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/pnl/unpriced', authMiddleware, async (_req, res) => {
  try {
    const { data: logs } = await supabase
      .from('usage_logs')
      .select('model')
      .eq('metadata->>rate_found', 'false')
      .limit(500);
    const models = Array.from(new Set((logs || []).map((l: any) => l.model)));
    res.json({ unpriced_models: models, calls_affected: (logs || []).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
