/*
 * routes/approvals.ts — Phase 3 monolith split (from index.ts L779–892).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitApproval, supabase } from '../ctx';
app.get('/api/v1/approvals', authMiddleware, async (req, res) => {
  try {
    const { client_id, status } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500);
    let query = supabase
      .from('approvals')
      .select('id, client_id, type, title, description, platform, status, requested_by, approved_by, reviewed_at, expires_at, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (client_id) query = query.eq('client_id', String(client_id));
    if (status) query = query.eq('status', String(status));
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// P1 Task 1 — invoices (Client 360 parked section)
// GET /api/v1/invoices?client_id=  → list; POST /api/v1/invoices → create.
// Table created by supabase/migration-p1-backend-gaps.sql.
app.get('/api/v1/invoices', authMiddleware, async (req, res) => {
  try {
    const { client_id, status } = req.query;
    let query = supabase
      .from('invoices')
      .select('id, client_id, package_key, amount, currency, status, due_at, paid_at, notes, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (client_id) query = query.eq('client_id', String(client_id));
    if (status) query = query.eq('status', String(status));
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: `invoice list failed: ${error.message} (run supabase/migration-p1-backend-gaps.sql if the table is missing)` });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/invoices', authMiddleware, async (req, res) => {
  try {
    const { client_id, package_key, amount, currency = 'INR', status = 'draft', due_at, notes } = req.body || {};
    if (!client_id) return res.status(400).json({ error: 'client_id required' });
    if (amount == null || isNaN(Number(amount))) return res.status(400).json({ error: 'amount (number) required' });
    const { data, error } = await supabase.from('invoices').insert({
      client_id, package_key,
      amount: Number(amount), currency, status,
      due_at: due_at || null, notes: notes || null,
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/approvals/pending', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/approvals/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .update({ status: 'approved', approved_by: 'director', reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    emitApproval({ ...data, action: 'approved' });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/approvals/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('approvals')
      .update({ status: 'rejected', approved_by: 'director', reviewed_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    emitApproval({ ...data, action: 'rejected' });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/approvals', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('approvals').insert(req.body).select().single();
    if (error) throw error;
    emitApproval({ ...data, action: 'created' });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

