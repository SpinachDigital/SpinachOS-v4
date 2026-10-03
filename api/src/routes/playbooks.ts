/*
 * routes/playbooks.ts — Sprint 12 §1: Playbooks as modules (blueprint §3.4).
 * Workflow-type packs as VERSIONED DATA — browse, preview contents (stages,
 * tasks, gates it will create), Install → creates a REAL pipeline from the
 * template (one click, logged in pipeline_events). Reuses the Sprint 10 gate
 * machinery (registers gates via the same gate_actions rows) — no reinvention.
 *
 * The installed instance is INDEPENDENT — editing the instance never mutates
 * the pack definition. Versioned installs: new installs get the pack's
 * current version; existing instances keep theirs (the installed version is
 * stamped on the workflow row).
 *
 *   GET  /playbooks                — the pack library
 *   GET  /playbooks/:slug          — pack preview (stages, tasks, gates)
 *   POST /playbooks/:slug/install  — install → real pipeline + linked tasks + gates
 */
import { app, authMiddleware, supabase } from '../ctx';

app.get('/api/v1/playbooks', authMiddleware, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('playbooks')
      .select('id, slug, name, workflow_type, version, description, created_at, updated_at')
      .order('workflow_type', { ascending: true })
      .order('version', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/playbooks/:slug', authMiddleware, async (req, res) => {
  try {
    const { data: pack, error } = await supabase
      .from('playbooks')
      .select('*')
      .eq('slug', req.params.slug)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!pack) return res.status(404).json({ error: 'playbook not found' });
    // Full preview: the stages, tasks, and gates this pack will create.
    res.json(pack);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/playbooks/:slug/install', authMiddleware, async (req, res) => {
  try {
    const { client_id, name } = req.body || {};
    if (!client_id) return res.status(400).json({ error: 'client_id required — install without a client is a dead click' });

    // Highest version of the pack (new installs get the new version).
    const { data: pack, error: packErr } = await supabase
      .from('playbooks')
      .select('*')
      .eq('slug', req.params.slug)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (packErr) throw packErr;
    if (!pack) return res.status(404).json({ error: 'playbook not found' });

    const stages: any[] = (pack.stages_json || []).map((s: any, i: number) => ({
      name: s.name,
      description: s.description || '',
      status: i === 0 ? 'in_progress' : 'pending',
      started_at: i === 0 ? new Date().toISOString() : null,
    }));
    if (stages.length === 0) return res.status(400).json({ error: 'pack has no stages — nothing to install' });

    // The installed instance is independent: it carries pack_slug + pack_version
    // (v1 upgrades never silently rewrite it), but its steps_json is its own copy.
    const { data: wf, error: wfErr } = await supabase
      .from('workflows')
      .insert({
        client_id,
        name: name || `${pack.name} (v${pack.version})`,
        status: 'active',
        current_step: stages[0].name,
        progress: 0,
        steps_json: stages,
        metadata: { pack_slug: pack.slug, pack_version: pack.version, installed_via: 'playbook', installed_at: new Date().toISOString() },
      })
      .select()
      .single();
    if (wfErr) throw wfErr;

    // Task templates → real linked tasks (the task→workflow linkage map from
    // Sprint 11 nit 7: workflow_id + step_name + client_id on the metadata).
    const tasks: any[] = (pack.tasks_json || []);
    const taskRows: any[] = [];
    for (const t of tasks) {
      const { data: tr, error: tErr } = await supabase
        .from('tasks')
        .insert({
          title: String(t.name).slice(0, 120),
          description: t.description || String(t.name),
          assigned_to: t.agent || 'ceo',
          status: 'todo',
          priority: 2,
          metadata: { workflow_id: wf.id, step_name: t.step_name || null, client_id, source: 'playbook', pack_slug: pack.slug },
        })
        .select()
        .single();
      if (!tErr && tr) taskRows.push(tr);
    }

    // Approval gates → the SAME gate machinery (gate_actions rows; the
    // pipeline pauses at the gate until approved — deny-by-default).
    const gates: any[] = (pack.gates_json || []);
    const gateRows: any[] = [];
    for (const g of gates) {
      const { data: gr, error: gErr } = await supabase
        .from('gate_actions')
        .insert({
          workflow_id: wf.id,
          client_id,
          gate_name: String(g.name),
          action: String(g.action || 'file_deliverable'), // Sprint 13 nit 2: fallback must be a VALID registered action (approve_deliverable isn't in KNOWN_ACTIONS — a pack missing an action would 400 at runtime)
          risk_tier: String(g.risk_tier || 'write'),
          payload_json: { from_playbook: pack.slug, pack_version: pack.version, after_step: g.after_step || null },
          requested_by: 'playbook',
          metadata: { escalation: false, from_playbook: pack.slug },
        })
        .select()
        .single();
      if (!gErr && gr) gateRows.push(gr);
    }

    // One click, logged — the install is visible in the replay + pipeline.
    await supabase.from('pipeline_events').insert({
      workflow_id: wf.id, client_id, event: 'playbook_installed',
      actor: 'founder',
      detail: { pack_slug: pack.slug, pack_version: pack.version, stages: stages.length, tasks: taskRows.length, gates: gateRows.length },
    });

    res.status(201).json({
      ok: true,
      workflow: wf,
      pack: { slug: pack.slug, version: pack.version },
      tasks_created: taskRows.length,
      gates_created: gateRows.length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
