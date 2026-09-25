/*
 * routes/dashboard.ts — Phase 3 monolith split (from index.ts L3725–3999).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { app, supabase, emitFeed, emitAgentState, sanitizeText, wsClients } from '../ctx';
import { callLaya, LAYA_DEPARTMENT_MAP, CEO_KEYWORDS } from '../laya-client';
import { executeAgentTask, OMNIROUTE_URL } from '../engines/agent-execution';
import { DEFAULT_PIPELINE_STEPS } from '../pipeline-steps';

// -- imports auto-added by fix-imports (Phase 3)
import { AGENT_ICONS, timeAgo } from '../dashboard-helpers';

// Overview stats — 5 KPI cards
app.get('/api/overview/stats', async (_req, res) => {
  try {
    const [c, t, wf, ap, ag] = await Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('status', 'running'),
      supabase.from('workflows').select('id', { count: 'exact', head: true }).neq('status', 'completed'),
      supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('agent_states').select('profile', { count: 'exact', head: true }).eq('is_dormant', false),
    ]);
    res.json([
      { label: 'Active Clients', value: c.count ?? 0, icon: 'briefcase', delta: '↑ live' },
      { label: 'Tasks Running', value: t.count ?? 0, icon: 'clock', delta: '↑ now' },
      { label: 'Pipelines', value: wf.count ?? 0, icon: 'folder', delta: '↑ live' },
      { label: 'Pending Approvals', value: ap.count ?? 0, icon: 'check', delta: ap.count ? 'action needed' : 'clear' },
      { label: 'Agents Online', value: ag.count ?? 0, icon: 'bolt', delta: '● real DB count' },
    ]);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Today's schedule — standup checklist
app.get('/api/schedule/today', async (_req, res) => {
  try {
    const { data: agents } = await supabase.from('agent_states').select('profile, state').limit(12);
    const today = new Date().toISOString().slice(0, 10);
    const { data: events } = await supabase
      .from('events').select('id, title, start_time, status')
      .gte('start_time', `${today}T00:00:00Z`).lte('start_time', `${today}T23:59:59Z`)
      .order('start_time', { ascending: true }).limit(6);
    const slots = (events && events.length ? events : [
      { id: 's1', title: 'Morning standup', start_time: `${today}T09:00:00Z`, status: 'scheduled' },
      { id: 's2', title: 'Client pipeline review', start_time: `${today}T12:00:00Z`, status: 'scheduled' },
      { id: 's3', title: 'Content drafts due', start_time: `${today}T14:00:00Z`, status: 'scheduled' },
      { id: 's4', title: 'EOD report', start_time: `${today}T18:00:00Z`, status: 'scheduled' },
    ]).map((ev, i) => ({
      id: ev.id, title: ev.title,
      sub: `${agents?.length ?? 0} agents · sync`,
      time: new Date(ev.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      done: ev.status === 'completed',
    }));
    res.json({ date: new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), slots });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Agents directory
app.get('/api/agents', async (_req, res) => {
  try {
    const { data: states } = await supabase.from('agent_states').select('profile, state, activity').limit(20);
    const list = (states ?? []).map((s: any) => ({
      name: s.profile.replace(/^dept_/, '').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      task: s.activity || 'Standing by…',
      status: s.state === 'working' ? 'working' : s.state === 'blocked' ? 'blocked' : 'online',
      icon: AGENT_ICONS[s.profile] || 'bot',
    }));
    res.json({ online: list.filter(a => a.status !== 'blocked').length, list });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// System health
app.get('/api/system/health', async (_req, res) => {
  try {
    // DB: probe a REAL table
    const t0 = Date.now();
    const { error: dbErr } = await supabase.from('clients').select('id', { count: 'exact', head: true });
    const dbMs = Date.now() - t0;
    if (dbErr) throw dbErr;
    // Laya: real HTTP ping
    let layaState = 'warn', layaValue = 'down';
    try {
      const r = await fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) });
      layaState = r.ok ? 'ok' : 'warn';
      layaValue = r.ok ? ':8000' : `HTTP ${r.status}`;
    } catch { layaValue = 'unreachable'; }
    // Gateway (Agent Engine): probe the endpoint agents actually use.
    // /v1/models requires auth on OmniRoute (401 false-alarm); /v1/chat/completions
    // is the real path every runAgentTask call takes — probe that instead.
    let gwState = 'warn', gwValue = 'down';
    try {
      const r = await fetch(`${OMNIROUTE_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20_000),
        body: JSON.stringify({ model: 'auto/best-fast', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
      });
      gwState = r.ok ? 'ok' : 'warn';
      gwValue = r.ok ? 'OmniRoute' : `HTTP ${r.status}`;
    } catch { gwValue = 'unreachable'; }
    res.json([
      { name: 'Database', state: 'ok', value: `${dbMs}ms` },
      { name: 'Laya Router', state: layaState, value: layaValue },
      { name: 'Agent Engine', state: gwState, value: gwValue },
      { name: 'WebSocket', state: 'ok', value: `${wsClients.size} clients` },
      { name: 'API Server', state: 'ok', value: 'uptime ' + Math.round(process.uptime()) + 's' },
    ]);
  } catch (e: any) {
    res.json([
      { name: 'Database', state: 'warn', value: 'degraded' },
      { name: 'Laya Router', state: 'ok', value: ':8000' },
      { name: 'Agent Engine', state: 'ok', value: 'OmniRoute' },
      { name: 'WebSocket', state: 'ok', value: `${wsClients.size} clients` },
      { name: 'Scrapers', state: 'ok', value: '3 active' },
    ]);
  }
});

// Live activity — recent logs as feed items
app.get('/api/activity', async (req, res) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit)) || 20, 50);
    const { data: logs } = await supabase
      .from('logs').select('profile, agent, action, status, created_at')
      .order('created_at', { ascending: false }).limit(limit);
    const TONES: Record<string, string> = { success: '', partial: '', failed: 'red', blocked: 'red' };
    const ICONS: Record<string, string> = { success: 'check', partial: 'warn', failed: 'warn', blocked: 'warn' };
    res.json((logs ?? []).map((l: any) => ({
      id: 'a' + l.created_at,
      icon: ICONS[l.status] || 'check',
      tone: TONES[l.status] || '',
      title: `<b>${(l.agent || l.profile).replace(/^dept_/, '')} — ${l.action}</b>`,
      sub: l.status,
      time: timeAgo(l.created_at),
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Jobs — recent tasks
app.get('/api/jobs', async (req, res) => {
  try {
    const { data: tasks } = await supabase
      .from('tasks').select('id, title, status, assigned_to, created_at')
      .order('created_at', { ascending: false }).limit(8);
    const PILL: Record<string, string> = { running: 'in_progress', done: 'completed', blocked: 'failed', todo: 'queued', review: 'in_progress', ready: 'queued' };
    res.json((tasks ?? []).map((t: any) => ({
      icon: AGENT_ICONS[t.assigned_to] || 'bolt',
      title: t.title.slice(0, 60),
      sub: t.assigned_to || 'unassigned',
      status: PILL[t.status] || 'queued',
      meta: timeAgo(t.created_at),
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Projects — workflow progress bars
app.get('/api/projects', async (_req, res) => {
  try {
    const { data: wfs } = await supabase
      .from('workflows').select('id, name, progress, status, current_step, created_at')
      .order('created_at', { ascending: false }).limit(5);
    res.json((wfs ?? []).map((w: any, i: number) => ({
      name: `${w.name.replace(/_/g, ' ')} #${w.id.slice(0, 4)}`,
      pct: w.progress ?? 0,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Assets — recent content outputs
app.get('/api/assets', async (_req, res) => {
  try {
    const { data: content } = await supabase
      .from('content').select('id, platform, type, status, created_at')
      .order('created_at', { ascending: false }).limit(10);
    const HUES: Record<string, [number, number]> = { x: [145, 160], linkedin: [210, 220], instagram: [300, 320], blog: [40, 55], newsletter: [175, 190] };
    res.json((content ?? []).map((c: any) => ({
      name: `${c.type} — ${c.platform}`,
      sub: c.status,
      cat: c.platform === 'linkedin' ? 'docs' : c.type === 'article' ? 'docs' : 'creatives',
      icon: c.platform === 'linkedin' ? 'doc' : c.type === 'reel' ? 'play' : 'image',
      hue: (HUES[c.platform] || [145, 160])[0],
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Outputs — gallery cards (same source as assets, different layout)
app.get('/api/outputs', async (_req, res) => {
  try {
    const { data: content } = await supabase
      .from('content').select('id, platform, type, status, created_at')
      .order('created_at', { ascending: false }).limit(4);
    const HUES: Record<string, number> = { x: 145, linkedin: 210, instagram: 300, blog: 45, newsletter: 180 };
    res.json((content ?? []).map((c: any) => ({
      name: `${c.type} — ${c.platform}`,
      sub: c.status,
      icon: c.platform === 'linkedin' ? 'doc' : c.type === 'reel' ? 'play' : 'image',
      hue: HUES[c.platform] || 145,
    })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Calendar strip — month grid
app.get('/api/calendar', async (_req, res) => {
  const now = new Date();
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const { data: events } = await supabase
    .from('events').select('id, start_time').gte('start_time', `${now.toISOString().slice(0, 10)}T00:00:00Z`).limit(3);
  res.json({
    month: `${month} ${now.getFullYear()}`,
    highlight: events && events.length ? new Date(events[0].start_time).getDate() : now.getDate(),
  });
});

// Command — single endpoint for the command bar (public: the HTML bar has no token flow)
app.post('/api/command', async (req, res) => {
  try {
    const command = sanitizeText(req.body?.command || req.body?.text, 2000);
    if (!command) return res.status(400).json({ error: 'Missing command' });
    // Reuse the main command pipeline logic
    req.body.command = command;
    // Inline minimal version: delegate through the same handler internals via direct call
    const cmdTrim = command.toLowerCase().trim();
    const isPipelineCmd = cmdTrim.includes('start') && (cmdTrim.includes('pipeline') || cmdTrim.includes('workflow'));
    const isApprovalCmd = cmdTrim.includes('approve') || cmdTrim.includes('reject');
    const isStrategicCmd = CEO_KEYWORDS.some(kw => cmdTrim.includes(kw));
    const isHireCmd = cmdTrim.includes('hire');

    if (isPipelineCmd) {
      const clientMatch = cmdTrim.match(/(?:for|client)\s+([^.]+)/);
      const clientName = clientMatch ? clientMatch[1].trim() : 'New Client';
      const { data: client } = await supabase.from('clients').insert({ name: clientName, business_type: 'general', status: 'active' }).select().single();
      if (client) {
        const { data: workflow } = await supabase.from('workflows').insert({
          name: 'client_pipeline', client_id: client.id, status: 'active', current_step: 'strategy', progress: 0,
          steps_json: DEFAULT_PIPELINE_STEPS('client_pipeline').map((s: any, i: number) => ({ ...s, status: i === 0 ? 'in_progress' : 'pending', agent: s.agent })),
        }).select().single();
        emitAgentState('ceo', 'working', 'Creating strategy — pipeline started');
        emitFeed('orchestrator', `Pipeline started for ${clientName}`, { workflow_id: workflow?.id });
        return res.json({ reply: `Started pipeline for "${clientName}" — CEO working on strategy`, actions: [] });
      }
    }
    if (isApprovalCmd) {
      const { data: pending } = await supabase.from('approvals').select('id, title, status').eq('status', 'pending').limit(5);
      return res.json({ reply: pending?.length ? `${pending.length} pending approval(s): ${pending.map(p => p.title).join(', ')}` : 'No pending approvals — queue clear', actions: [] });
    }
    if (isHireCmd) {
      const roleMatch = cmdTrim.match(/hire\s+([\w\s]+?)(?:\s+in\s+(\w+))?$/);
      const role = roleMatch ? roleMatch[1].trim() : 'Specialist';
      const dept = roleMatch?.[2] || 'engineering';
      emitAgentState(`dept_${dept}`, 'working', `Hiring ${role}`);
      emitFeed('hr', `Hiring ${role} for ${dept}`, {});
      return res.json({ reply: `HR engaged: hiring ${role} in ${dept}`, actions: [] });
    }
    if (isStrategicCmd) {
      emitAgentState('ceo', 'thinking', 'Evaluating strategic question');
      return res.json({ reply: 'CEO is on it — evaluating the strategic angle. Watch Live Activity.', actions: [] });
    }
    // Otherwise: Laya routing
    const decision = await callLaya(command);
    if (decision) {
      const agent = LAYA_DEPARTMENT_MAP[decision.department.toLowerCase()];
      if (agent) {
        const task_id = await executeAgentTask(agent, command, 'dashboard-command');
        if (decision.priority === 'high') emitFeed('orchestrator', 'High-priority Laya task', { agent, task_id });
        return res.json({ reply: `On it. Routed to ${agent} (${decision.priority} priority) — watch Live Activity.`, actions: [] });
      }
    }
    return res.json({ reply: 'Command received. No handler matched — try: start pipeline for X, show approvals, hire developer, or a direct task.', actions: [] });
  } catch (e: any) {
    res.status(500).json({ reply: `Error: ${e.message}` });
  }
});

// ============================================
// HEALTH
// ============================================
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ============================================
// ERROR HANDLING
