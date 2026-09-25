/*
 * routes/workflows.ts — Phase 3 monolith split (from index.ts L1340–1441).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitAgentState, emitWorkflow, supabase } from '../ctx';
import { DEFAULT_PIPELINE_STEPS } from '../pipeline-steps';
app.get('/api/v1/workflows', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('workflows').select('*').order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});


app.post('/api/v1/workflows', authMiddleware, async (req, res) => {
  let steps: any[] = [];
  let stepsError: any = null;
  try {
    const { data: rpcSteps } = await supabase.rpc('create_workflow_steps', {
      p_workflow_name: req.body.name,
      p_client_id: req.body.client_id,
    });
    steps = rpcSteps?.steps || [];
  } catch (e: any) {
    stepsError = e;
  }

  // RPC missing or returned nothing → fall back to the default 8-step pipeline
  if (!steps || steps.length === 0) {
    steps = DEFAULT_PIPELINE_STEPS(req.body.name || 'Untitled workflow');
  }

  const workflow = {
    ...req.body,
    steps_json: steps,
    current_step: steps[0]?.name || null,
  };

  const { data, error } = await supabase.from('workflows').insert(workflow).select().single();
  if (error) return res.status(500).json({ error: error.message });

  emitWorkflow(data);
  emitAgentState('ceo', 'working', `Creating strategy: ${req.body.name || 'Untitled workflow'}`);
  res.status(201).json(data);
});

app.get('/api/v1/workflows/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Workflow not found' });
  res.json(data);
});

app.patch('/api/v1/workflows/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('workflows').update(req.body).eq('id', req.params.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  emitWorkflow(data);
  res.json(data);
});

app.get('/api/v1/leads', authMiddleware, async (req, res) => {
  const { client_id, status } = req.query;
  let query = supabase.from('leads').select('*');
  if (client_id) query = query.eq('client_id', client_id);
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/v1/content', authMiddleware, async (req, res) => {
  const { client_id, status, platform } = req.query;
  let query = supabase.from('content').select('*');
  if (client_id) query = query.eq('client_id', client_id);
  if (status) query = query.eq('status', status);
  if (platform) query = query.eq('platform', platform);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/v1/logs', authMiddleware, async (req, res) => {
  const { profile, action, limit } = req.query;
  let query = supabase.from('logs').select('*');
  if (profile) query = query.eq('profile', profile);
  if (action) query = query.eq('action', action);
  if (limit) query = query.limit(parseInt(limit as string));
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

// ============================================
// AGENT STATES
// ============================================
