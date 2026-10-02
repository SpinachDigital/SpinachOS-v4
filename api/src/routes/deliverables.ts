/*
 * routes/deliverables.ts — Sprint 10 §3/§4: filed deliverables API.
 * GET /api/v1/deliverables?client_id= → the client twin's filed assets
 * (every deliverable filed by an approved gate — released_by, version,
 * released_at). Filing without listing is invisible; this is the twin's
 * read side.
 */
import { app, authMiddleware, supabase } from '../ctx';

app.get('/api/v1/deliverables', authMiddleware, async (req, res) => {
  try {
    const { client_id, workflow_id } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    let query = supabase
      .from('deliverables')
      .select('id, client_id, workflow_id, gate_action_id, title, kind, content, file_url, version, released_by, released_at, approval_id, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (client_id) query = query.eq('client_id', String(client_id));
    if (workflow_id) query = query.eq('workflow_id', String(workflow_id));
    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
