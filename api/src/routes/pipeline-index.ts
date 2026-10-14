/*
 * routes/pipeline.ts — Sprint 10 P1 addition: pipelines INDEX endpoint.
 * GET /api/v1/pipelines-index → every workflow with client name + computed
 * step counts (the /pipeline index page payload). Reuses the same shapes as
 * /pipelines/:id. Added by Sprint 10 (the index page owns it).
 */
import { app, authMiddleware, supabase } from '../ctx';

app.get('/api/v1/pipelines-index', authMiddleware, async (req, res) => {
  try {
    const { status } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    let query = supabase
      .from('workflows')
      .select('id, name, client_id, status, progress, current_step, steps_json, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status) query = query.eq('status', String(status));
    const { data: rows, error } = await query;
    if (error) throw error;

    // client names (bounded: one query, map in memory)
    const clientIds = Array.from(new Set((rows || []).map((r: any) => r.client_id).filter(Boolean)));
    const { data: clients } = clientIds.length
      ? await supabase.from('clients').select('id, name').in('id', clientIds)
      : { data: [] };
    const nameById = new Map((clients || []).map((c: any) => [c.id, c.name]));

    const pipelines = (rows || []).map((r: any) => {
      const steps = r.steps_json || [];
      // N2 §3 deal-rotting: idle_hours = hours since the current step's last
      // activity (row updated_at as the activity clock). stuck = idle 72h+ or
      // the explicit blocked status. Honest null when the row carries no clock.
      const updatedMs = r.updated_at ? new Date(r.updated_at).getTime() : NaN;
      const idle_hours = Number.isFinite(updatedMs)
        ? Math.round(((Date.now() - updatedMs) / 3_600_000) * 10) / 10
        : null;
      const stuck = (idle_hours != null && idle_hours >= 72) || r.status === 'blocked';
      return {
        id: r.id,
        name: r.name,
        client_id: r.client_id,
        client_name: nameById.get(r.client_id) || null,
        status: r.status,
        progress: r.progress,
        current_step: r.current_step,
        total_steps: steps.length,
        completed_steps: steps.filter((s: any) => s.status === 'completed').length,
        created_at: r.created_at,
        idle_hours,
        stuck,
      };
    });
    res.json({ pipelines, count: pipelines.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
