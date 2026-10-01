/*
 * routes/hr.ts — Phase 3 split + Sprint 5d rewrite.
 *
 * KEPT (no behavior changes): /agent-states GET+PATCH, /hierarchy, /hr/departments,
 *   /hr/agents, /hr/hire, /hr/agent-message, /hr/agent-messages, /hr/bulk-action,
 *   /hr/agent-task, /hr/org-chart.
 * BUILT (Sprint 5d, authMiddleware + hr_actions audit trail): /hr/roster,
 *   /hr/flags, /hr/flags/:id/resolve, /hr/agents/:id/pause|resume,
 *   /hr/tasks/:id/reassign, /hr/tasks/:id/stop, /hr/stats/weekly, /hr/activity.
 * DELETED (5g WON'T DO): /hr/performance-review (human-typed-score endpoint).
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, AgentMessageSchema, BulkAgentActionSchema, HireAgentSchema, authMiddleware, emitAgentState, emitFeed, supabase } from '../ctx';
import { executeAgentTask } from '../engines/agent-execution';
app.get('/api/v1/agent-states', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('agent_states').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.patch('/api/v1/agent-states/:profile', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('agent_states')
    .upsert({ profile: req.params.profile, ...req.body })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  emitAgentState(req.params.profile, req.body.state, req.body.activity);
  res.json(data);
});

// ============================================
// HR DEPARTMENT & MULTI-AGENT SYSTEM — Sprint 6 MUST-FIX (a): fully DB-backed.
// The old in-memory agentRegistry + static departmentLeads + fake performance_score
// are GONE: every endpoint reads/writes hr_agents (the seeded roster = one identity:
// agent_states.profile = hermes-profiles dir name). Hiring = EXISTING profiles only.
// ============================================

// GET /hr/departments — departments from hr_agents (live roster)
app.get('/api/v1/hr/departments', authMiddleware, async (_req, res) => {
  try {
    const { data: agents, error } = await supabase
      .from('hr_agents')
      .select('id, name, department, role, specialization, status, created_at')
      .order('department')
      .order('created_at');
    if (error) return res.status(500).json({ error: error.message });

    const deptNames = Array.from(new Set((agents || []).map(a => a.department)));
    const deptDetails = deptNames.map(dept => {
      const deptAgents = (agents || []).filter(a => a.department === dept);
      const lead = deptAgents[0]; // first-hired = lead
      return {
        name: dept,
        lead: lead?.id,
        lead_name: lead?.name,
        agent_count: deptAgents.length,
        agents: deptAgents.map(a => ({ id: a.id, name: a.name, role: a.role, status: a.status })),
      };
    });
    res.json(deptDetails);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /hr/agents — roster from hr_agents (filters: department, status)
app.get('/api/v1/hr/agents', authMiddleware, async (req, res) => {
  try {
    const { department, status } = req.query;
    let q = supabase.from('hr_agents').select('id, name, department, role, specialization, skills, status, created_at');
    if (department) q = q.eq('department', department);
    if (status) q = q.eq('status', status);
    q = q.order('department').order('created_at');
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /hierarchy — the org tree: leadership → HODs → benches (Part B in-app representation)
// Data: agent_states (tier/reports_to/is_dormant/bench) + live state; bench = per-dept specialist slots.
app.get('/api/v1/hierarchy', authMiddleware, async (_req, res) => {
  const { data: rows, error } = await supabase
    .from('agent_states')
    .select('profile, state, activity, tier, reports_to, display_name, is_dormant, bench, updated_at')
    .order('profile');
  if (error) return res.status(500).json({ error: `hierarchy failed: ${error.message}` });

  // Bench configs per HOD (Part B Tier 3) — static definitions, shown as on-demand slots
  const BENCHES: Record<string, string[]> = {
    designer: ['logo_specialist', 'guidelines_specialist', 'deck_specialist', 'social_creative_specialist'],
    engineer: ['frontend_specialist', 'backend_specialist', 'automation_specialist', 'qa_specialist'],
    social: ['copywriter', 'calendar_planner', 'community_specialist'],
    ads_manager: ['meta_buyer', 'google_buyer', 'creative_tester'],
    seo_specialist: ['technical_seo', 'content_seo', 'gmb_specialist', 'review_manager'],
    research: ['market_analyst', 'competitor_analyst', 'lead_researcher'],
    sales: ['sdr_outreach', 'proposal_writer', 'followup_specialist'],
  };

  const profiles = (rows || []).filter((r: any) => r.tier === 'leadership' || r.tier === 'hod');
  const leadership = profiles.filter((p: any) => p.tier === 'leadership');
  const hods = profiles.filter((p: any) => p.tier === 'hod');

  const tree = leadership.map((lead: any) => ({
    ...lead,
    children: hods
      .filter((h: any) => h.reports_to === lead.profile)
      .map((h: any) => ({
        ...h,
        bench: (BENCHES[h.profile] || []).map((slot: string) => ({
          profile: slot,
          tier: 'executive',
          status: 'available', // on-demand: loaded per task from the specialist pool
          current_task: null,
        })),
      })),
  }));

  // HODs with no reports_to set (shouldn't happen post-fix, but render honestly)
  const orphans = hods.filter((h: any) => !h.reports_to || !leadership.some((l: any) => l.profile === h.reports_to));

  res.json({ leadership: tree, orphans, total_hods: hods.length, dormant: hods.filter((h: any) => h.is_dormant).map((h: any) => h.profile) });
});

// POST /hr/hire — Sprint 6 MUST-FIX: hire ONLY an EXISTING hermes-profiles agent.
// No fake ids, no invented agents, no hardcoded performance_score. The request
// names an agent id that must already exist in hr_agents (the seeded roster);
// re-hiring an offboarded/paused agent re-activates it. Everything DB-backed.
app.post('/api/v1/hr/hire', authMiddleware, async (req, res) => {
  const parse = HireAgentSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    // The schema's `department`/`role` fields are treated as the EXISTING agent id
    // (department = hermes-profiles dir name). Accept both shapes:
    //   { department: 'engineer', role: '...' }  or { agent_id: 'engineer' }
    const requestedId = String(parse.data.agent_id || parse.data.department || '').trim().toLowerCase();
    if (!requestedId) return res.status(400).json({ error: 'agent_id (existing hermes-profiles dir name) required' });

    const { data: agent, error: fetchErr } = await supabase
      .from('hr_agents')
      .select('id, name, department, role, specialization, skills, status')
      .eq('id', requestedId)
      .single();
    if (fetchErr || !agent) {
      return res.status(400).json({
        error: `Agent '${requestedId}' does not exist. Hiring creates nothing — only existing hermes-profiles agents can be hired. Seed via scripts/seed-hr-agents.ts first.`,
      });
    }

    if (agent.status === 'active') {
      return res.status(409).json({ error: `Agent '${requestedId}' is already active`, agent });
    }

    const actor = (req as any).user?.role === 'founder' ? 'founder' : 'hr_director';
    const { data: updated, error: upErr } = await supabase
      .from('hr_agents')
      .update({ status: 'active' })
      .eq('id', requestedId)
      .select()
      .single();
    if (upErr) return res.status(500).json({ error: upErr.message });

    await supabase.from('agent_states').upsert({
      profile: requestedId,
      state: 'idle',
      activity: 'Hired (re-activated) — ready for tasks',
    });
    emitAgentState(requestedId, 'idle', 'Hired (re-activated) — ready for tasks');
    emitFeed('hr', `Agent hired: ${agent.name}`, { agent_id: requestedId, department: agent.department });

    // audit trail
    await supabase.from('hr_actions').insert({
      actor,
      action: 'hire',
      agent_id: requestedId,
      reason: `hired (status was ${agent.status})`,
    });

    res.status(201).json({ success: true, agent: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/hr/agent-message', authMiddleware, async (req, res) => {
  const parse = AgentMessageSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    const { from_agent, to_agent, message, type, payload, requires_response } = parse.data;

    // Validate BOTH agents exist in hr_agents (DB-backed — no registry)
    const { data: agents, error: aErr } = await supabase
      .from('hr_agents')
      .select('id, name, department')
      .in('id', [from_agent, to_agent]);
    if (aErr) return res.status(500).json({ error: aErr.message });
    const found = new Map((agents || []).map(a => [a.id, a]));
    if (!found.has(from_agent)) return res.status(404).json({ error: `From agent ${from_agent} not found` });
    if (!found.has(to_agent)) return res.status(404).json({ error: `To agent ${to_agent} not found` });

    // Log the message
    const messageRecord = {
      id: crypto.randomUUID(),
      from_agent,
      to_agent,
      message,
      type,
      payload,
      requires_response,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    // Store in logs table
    await supabase.from('logs').insert({
      profile: from_agent,
      agent: from_agent,
      action: `agent_message_${type}`,
      input_json: { to_agent, message, payload },
      output_json: { status: 'sent', requires_response },
      status: 'success',
      metadata: { message_id: messageRecord.id },
    });

    // Update sender state
    emitAgentState(from_agent, 'speaking', `Sending ${type} to ${to_agent}: ${message.slice(0, 50)}`);

    // Update receiver state
    emitAgentState(to_agent, 'thinking', `Received ${type} from ${from_agent}: ${message.slice(0, 50)}`);

    // If it's a task, create a task record
    if (type === 'task') {
      // BOT MODE BRIDGE (REVIEW.md promise): @mention → HOD profile invocation.
      // The message isn't just logged — it dispatches to the receiving agent's REAL
      // brain via the execution bridge (profile/gateway by task kind), WS events flow.
      const task_id = await executeAgentTask(to_agent, message, `agent-message:${messageRecord.id}`);
      await supabase.from('tasks').insert({
        title: message.slice(0, 100),
        description: message,
        assigned_to: to_agent,
        status: 'running',
        metadata: { from_agent, payload, requires_response, message_id: messageRecord.id, bridge_task_id: task_id },
      });
    }

    res.json({ success: true, message: messageRecord, to_agent: found.get(to_agent)!.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/hr/agent-messages', authMiddleware, async (req, res) => {
  try {
    const { agent, limit } = req.query;
    let query = supabase.from('logs').select('*').eq('action', 'agent_message_task');
    if (agent) query = query.or(`profile.eq.${agent},metadata->>to_agent.eq.${agent}`);
    if (limit) query = query.limit(parseInt(limit as string));
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/hr/bulk-action', authMiddleware, async (req, res) => {
  const parse = BulkAgentActionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    const { department, agents: agentIds, action } = parse.data;
    let q = supabase.from('hr_agents').select('id, name, department, status');
    if (department) q = q.eq('department', department);
    if (agentIds && agentIds.length > 0) q = q.in('id', agentIds);
    const { data: targets, error: tErr } = await q;
    if (tErr) return res.status(500).json({ error: tErr.message });
    if (!targets || targets.length === 0) return res.status(404).json({ error: 'No agents matched' });

    const results = [];
    for (const agent of targets) {
      const newState = action === 'start' || action === 'resume' ? 'active' : action === 'stop' || action === 'pause' ? 'paused' : agent.status;
      const activity =
        action === 'start' ? 'Started by bulk action'
        : action === 'stop' ? 'Stopped by bulk action'
        : action === 'pause' ? 'Paused by bulk action'
        : action === 'resume' ? 'Resumed by bulk action'
        : `Status: ${newState}`;

      if (newState !== agent.status) {
        const { error: uErr } = await supabase.from('hr_agents').update({ status: newState }).eq('id', agent.id);
        if (uErr) { results.push({ id: agent.id, name: agent.name, error: uErr.message }); continue; }
      }

      await supabase.from('agent_states').upsert({
        profile: agent.id,
        state: action === 'stop' || action === 'pause' ? 'idle' : 'working',
        activity,
      });
      emitAgentState(agent.id, action === 'stop' || action === 'pause' ? 'idle' : 'working', activity);
      results.push({ id: agent.id, name: agent.name, status: newState, activity });
    }

    res.json({ success: true, action, agents_affected: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/hr/agent-task', authMiddleware, async (req, res) => {
  try {
    const { agent_id, task_title, task_description, priority = 0, dependencies = [] } = req.body;
    if (!agent_id || !task_title) return res.status(400).json({ error: 'agent_id + task_title required' });

    // Validate the agent exists in hr_agents (DB-backed — no registry)
    const { data: agent, error: aErr } = await supabase
      .from('hr_agents')
      .select('id, name, department, status')
      .eq('id', agent_id)
      .single();
    if (aErr || !agent) return res.status(404).json({ error: `Agent ${agent_id} not found` });

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: task_title,
        description: task_description,
        assigned_to: agent_id,
        status: 'running',
        priority,
        dependencies,
        metadata: { assigned_by: 'director', department: agent.department },
      })
      .select()
      .single();

    if (error) throw error;

    // Update agent state
    await supabase.from('agent_states').upsert({
      profile: agent_id,
      state: 'working',
      activity: `Working on: ${task_title}`,
      current_task_id: task.id,
    });
    emitAgentState(agent_id, 'working', `Working on: ${task_title}`);

    emitFeed(agent.department === 'executive' ? 'ceo' : agent.department, 'Task assigned', { agent_id, task_id: task.id, title: task_title });

    res.json({ success: true, task, agent: agent.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /hr/org-chart — org tree from hr_agents (leads = first-hired per dept) + hired reports
app.get('/api/v1/hr/org-chart', authMiddleware, async (_req, res) => {
  try {
    const { data: agents, error } = await supabase
      .from('hr_agents')
      .select('id, name, department, role, status, created_at')
      .order('department')
      .order('created_at');
    if (error) return res.status(500).json({ error: error.message });

    const orgChart: Record<string, Record<string, any>> = {};
    for (const a of agents || []) {
      if (!orgChart[a.department]) orgChart[a.department] = {};
      const deptAgents = (agents || []).filter(x => x.department === a.department);
      if (deptAgents[0]?.id === a.id) {
        orgChart[a.department][a.id] = { ...a, reports: [] };
      }
    }
    // non-lead agents become reports of their dept lead
    for (const a of agents || []) {
      const deptAgents = (agents || []).filter(x => x.department === a.department);
      const lead = deptAgents[0];
      if (lead && lead.id !== a.id && orgChart[a.department]?.[lead.id]) {
        orgChart[a.department][lead.id].reports.push({ id: a.id, name: a.name, role: a.role, status: a.status });
      }
    }

    res.json(orgChart);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Sprint 5d: /hr/performance-review DELETED — appraisals and human-typed scores are out of scope (5g).

// ============================================
// DAILY OPERATIONS ENGINE
// ============================================

// ============================================
// SPRINT 5d — HR OPERATIONS (DB-backed, audited)
// ============================================

// ---- helpers ----
const hrLog = async (actor: 'founder' | 'hr_director', action: string, agentId?: string | null, taskId?: string | null, reason?: string | null) => {
  await supabase.from('hr_actions').insert({ actor, action, agent_id: agentId || null, task_id: taskId || null, reason: reason || null });
};

const paginate = (req: any) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100); // §4: default 20, max 100
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
  return { limit, offset };
};

// GET /hr/roster — agents + live state + current task + queue depth (paginated)
app.get('/api/v1/hr/roster', authMiddleware, async (req, res) => {
  try {
    const { limit, offset } = paginate(req);
    const department = req.query.department as string | undefined;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    let q = supabase.from('hr_agents').select('*', { count: 'exact' });
    if (department) q = q.eq('department', department);
    if (status) q = q.eq('status', status);
    if (search) q = q.or(`name.ilike.%${search}%,role.ilike.%${search}%,department.ilike.%${search}%`);
    q = q.order('department').order('name').range(offset, offset + limit - 1);
    const { data: agents, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });

    const ids = (agents || []).map(a => a.id);
    if (ids.length === 0) return res.json({ agents: [], total: count || 0, limit, offset });

    // live state + current task + queue depth (batched, §4)
    const { data: states } = await supabase
      .from('agent_states')
      .select('profile, state, activity, current_task_id, updated_at')
      .in('profile', ids);
    const stateMap = new Map((states || []).map(s => [s.profile, s]));

    const { data: running } = await supabase
      .from('tasks')
      .select('id, title, assigned_to, progress')
      .eq('status', 'running')
      .in('assigned_to', ids);
    const runningMap = new Map((running || []).map(t => [t.assigned_to, t]));

    const { data: queued } = await supabase
      .from('tasks')
      .select('id, assigned_to')
      .eq('status', 'ready')
      .in('assigned_to', ids);
    const queueDepth = new Map<string, number>();
    for (const t of queued || []) queueDepth.set(t.assigned_to as string, (queueDepth.get(t.assigned_to as string) || 0) + 1);

    // week stats (real: tasks completed in the last 7 days per agent)
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: weekDone } = await supabase
      .from('tasks')
      .select('assigned_to, id')
      .eq('status', 'done')
      .gte('updated_at', weekAgo)
      .in('assigned_to', ids);
    const weekDoneMap = new Map<string, number>();
    for (const t of weekDone || []) weekDoneMap.set(t.assigned_to as string, (weekDoneMap.get(t.assigned_to as string) || 0) + 1);

    const roster = (agents || []).map(a => {
      const st = stateMap.get(a.id);
      const cur = runningMap.get(a.id);
      const isPaused = a.status === 'paused';
      const isFlagged = false; // flags joined in /hr/flags; page marks via flags panel
      const liveState = isPaused ? 'paused' : (st?.state === 'working' ? 'working' : 'idle');
      return {
        id: a.id,
        name: a.name,
        department: a.department,
        role: a.role,
        specialization: a.specialization,
        skills: a.skills || [],
        status: liveState,
        live_state: st?.state || 'idle',
        activity: st?.activity || null,
        current_task: cur ? { id: cur.id, title: cur.title, progress: cur.progress ?? 0 } : null,
        queue_depth: queueDepth.get(a.id) || 0,
        week_completed: weekDoneMap.get(a.id) || 0,
        updated_at: st?.updated_at || null,
      };
    });
    res.json({ agents: roster, total: count || 0, limit, offset });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /hr/flags — open flags, severity-sorted (paginated)
app.get('/api/v1/hr/flags', authMiddleware, async (req, res) => {
  try {
    const { limit, offset } = paginate(req);
    const q = supabase
      .from('hr_flags')
      .select('*, hr_agents(name, department, role)', { count: 'exact' })
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    // severity sort: high → medium → low (created_at desc within a severity)
    const sevRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const flags = (data || []).sort((a: any, b: any) => (sevRank[a.severity] ?? 3) - (sevRank[b.severity] ?? 3));
    res.json({ flags, total: count || 0, limit, offset });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /hr/flags/:id/resolve — human resolve (audited)
app.post('/api/v1/hr/flags/:id/resolve', authMiddleware, async (req, res) => {
  try {
    const actor = (req as any).user?.role === 'founder' ? 'founder' : 'hr_director';
    const { data, error } = await supabase
      .from('hr_flags')
      .update({ resolved_at: new Date().toISOString(), resolved_by: actor })
      .eq('id', req.params.id)
      .is('resolved_at', null)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Flag not found or already resolved' });
    await hrLog(actor, 'resolve', data.agent_id, null, `resolved flag ${data.type}`);
    res.json({ success: true, flag: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /hr/agents/:id/pause — founder pause ({reason}) — audited; enforced in agent-execution
app.post('/api/v1/hr/agents/:id/pause', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string') return res.status(400).json({ error: 'reason required' });
    const actor = (req as any).user?.role === 'founder' ? 'founder' : 'hr_director';
    const { data, error } = await supabase
      .from('hr_agents')
      .update({ status: 'paused' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Agent not found' });
    await supabase.from('agent_states').upsert({ profile: req.params.id, state: 'idle', activity: `Paused: ${reason.slice(0, 80)}` });
    await hrLog(actor, 'pause', req.params.id, null, reason);
    res.json({ success: true, agent: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /hr/agents/:id/resume — audited
app.post('/api/v1/hr/agents/:id/resume', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body || {};
    const actor = (req as any).user?.role === 'founder' ? 'founder' : 'hr_director';
    const { data, error } = await supabase
      .from('hr_agents')
      .update({ status: 'active' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'Agent not found' });
    await supabase.from('agent_states').upsert({ profile: req.params.id, state: 'idle', activity: `Resumed${reason ? ': ' + String(reason).slice(0, 60) : ''}` });
    await hrLog(actor, 'resume', req.params.id, null, reason || null);
    res.json({ success: true, agent: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /hr/tasks/:id/reassign ({to_agent, note}) — note lands in the task metadata timeline
app.post('/api/v1/hr/tasks/:id/reassign', authMiddleware, async (req, res) => {
  try {
    const { to_agent, note } = req.body || {};
    if (!to_agent || typeof to_agent !== 'string') return res.status(400).json({ error: 'to_agent required' });
    const actor = (req as any).user?.role === 'founder' ? 'founder' : 'hr_director';

    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, title, assigned_to, metadata, status')
      .eq('id', req.params.id)
      .single();
    if (taskErr || !task) return res.status(404).json({ error: 'Task not found' });

    const { data: agent, error: agentErr } = await supabase
      .from('hr_agents')
      .select('id, name, status')
      .eq('id', to_agent)
      .single();
    if (agentErr || !agent) return res.status(404).json({ error: `Target agent ${to_agent} not found` });

    // timeline entry in task metadata (reassignment history)
    const prevMeta = task.metadata || {};
    const timeline = Array.isArray(prevMeta.timeline) ? prevMeta.timeline : [];
    timeline.push({
      at: new Date().toISOString(),
      event: 'reassigned',
      from: task.assigned_to,
      to: to_agent,
      note: note || null,
      by: actor,
    });
    const { data: updated, error } = await supabase
      .from('tasks')
      .update({ assigned_to: to_agent, metadata: { ...prevMeta, timeline } })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await hrLog(actor, 'reassign', to_agent, req.params.id, note || `from ${task.assigned_to} to ${to_agent}`);
    res.json({ success: true, task: updated, from: task.assigned_to, to: to_agent });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /hr/tasks/:id/stop ({reason}) — kill switch (audited)
app.post('/api/v1/hr/tasks/:id/stop', authMiddleware, async (req, res) => {
  try {
    const { reason } = req.body || {};
    if (!reason || typeof reason !== 'string') return res.status(400).json({ error: 'reason required' });
    const actor = (req as any).user?.role === 'founder' ? 'founder' : 'hr_director';

    const { data: task, error: taskErr } = await supabase
      .from('tasks')
      .select('id, title, assigned_to, metadata')
      .eq('id', req.params.id)
      .single();
    if (taskErr || !task) return res.status(404).json({ error: 'Task not found' });

    const prevMeta = task.metadata || {};
    const timeline = Array.isArray(prevMeta.timeline) ? prevMeta.timeline : [];
    timeline.push({ at: new Date().toISOString(), event: 'stopped', reason, by: actor });
    const { data: updated, error } = await supabase
      .from('tasks')
      .update({ status: 'blocked', metadata: { ...prevMeta, timeline, stopped_reason: reason } })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: error.message });

    await hrLog(actor, 'stop', task.assigned_to, req.params.id, reason);
    res.json({ success: true, task: updated });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /hr/stats/weekly — REAL per-agent completed + avg duration + dept totals (from tasks)
app.get('/api/v1/hr/stats/weekly', authMiddleware, async (_req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: done, error } = await supabase
      .from('tasks')
      .select('id, title, assigned_to, metadata, created_at, updated_at')
      .eq('status', 'done')
      .gte('updated_at', weekAgo);
    if (error) return res.status(500).json({ error: error.message });

    const byAgent = new Map<string, { completed: number; totalMs: number }>();
    for (const t of done || []) {
      if (!t.assigned_to) continue;
      const started = t.metadata?.started_at ? new Date(t.metadata.started_at).getTime() : new Date(t.created_at).getTime();
      const dur = Math.max(new Date(t.updated_at).getTime() - started, 0);
      const cur = byAgent.get(t.assigned_to) || { completed: 0, totalMs: 0 };
      cur.completed++;
      cur.totalMs += dur;
      byAgent.set(t.assigned_to, cur);
    }

    const { data: agents } = await supabase.from('hr_agents').select('id, name, department');
    const deptTotals = new Map<string, { completed: number; agents: number }>();
    const perAgent = (agents || []).map(a => {
      const s = byAgent.get(a.id) || { completed: 0, totalMs: 0 };
      const dt = deptTotals.get(a.department) || { completed: 0, agents: 0 };
      dt.completed += s.completed;
      dt.agents++;
      deptTotals.set(a.department, dt);
      return {
        agent_id: a.id, name: a.name, department: a.department,
        completed: s.completed,
        avg_duration_min: s.completed ? Math.round(s.totalMs / s.completed / 60000) : 0,
      };
    });

    const departments = Array.from(deptTotals.entries()).map(([name, d]) => ({ department: name, completed: d.completed, agents: d.agents }));
    res.json({ week_started_at: weekAgo, per_agent: perAgent, departments, total_completed: (done || []).length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /hr/activity — recent hr_actions (paginated)
app.get('/api/v1/hr/activity', authMiddleware, async (req, res) => {
  try {
    const { limit, offset } = paginate(req);
    const { data, error, count } = await supabase
      .from('hr_actions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ activity: data || [], total: count || 0, limit, offset });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
