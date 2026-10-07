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
    // Phase 8.1 GOAL 3: the instance INHERITS the pack's client_visible flag —
    // the gate reads ONE table (workflows) at file time.
    const { data: wf, error: wfErr } = await supabase
      .from('workflows')
      .insert({
        client_id,
        name: name || `${pack.name} (v${pack.version})`,
        status: 'active',
        current_step: stages[0].name,
        progress: 0,
        steps_json: stages,
        client_visible: !!(pack as any).client_visible,
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

// ---------------------------------------------------------------------
// Phase 6 GOAL 2 — PACKAGE DESIGNER: base package + à la carte add-ons
// → live total → "save as custom playbook" (versioned, reusable).
// ---------------------------------------------------------------------
app.post('/api/v1/playbooks/designer/quote', authMiddleware, async (req, res) => {
  try {
    const baseSlug = String(req.body?.base_slug || '').replace(/^.*\//, '');
    const addons: string[] = Array.isArray(req.body?.addons) ? req.body.addons.map((a: any) => String(a).replace(/^.*\//, '')) : [];
    if (!baseSlug) return res.status(400).json({ error: 'base_slug required' });

    // Base pack (highest version)
    const { data: base } = await supabase.from('playbooks')
      .select('slug, name, version, metadata, stages_json, tasks_json, gates_json')
      .eq('slug', baseSlug).order('version', { ascending: false }).limit(1).maybeSingle();
    if (!base) return res.status(404).json({ error: `base playbook "${baseSlug}" not found` });

    // Add-on packs (workflow_type='addon')
    const addonRows = addons.length
      ? (await supabase.from('playbooks')
          .select('slug, name, version, metadata, stages_json, tasks_json, gates_json')
          .in('slug', addons)
          .eq('workflow_type', 'addon')
          .order('version', { ascending: false })).data || []
      : [];

    const basePrice = Number(base.metadata?.price_inr || 0);
    const addonPrices = addonRows.map(a => Number(a.metadata?.price_inr || 0));
    const total = basePrice + addonPrices.reduce((s, p) => s + p, 0);

    res.json({
      ok: true,
      base: { slug: base.slug, name: base.name, price_inr: basePrice },
      addons: addonRows.map((a, i) => ({ slug: a.slug, name: a.name, price_inr: addonPrices[i] })),
      total_inr: total,
      combined_stages: [
        ...(Array.isArray(base.stages_json) ? base.stages_json : []),
        ...addonRows.flatMap(a => (Array.isArray(a.stages_json) ? a.stages_json : [])),
      ].length,
      combined_gates: [
        ...(Array.isArray(base.gates_json) ? base.gates_json : []),
        ...addonRows.flatMap(a => (Array.isArray(a.gates_json) ? a.gates_json : [])),
      ].length,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/playbooks/designer/save', authMiddleware, async (req, res) => {
  try {
    const baseSlug = String(req.body?.base_slug || '').replace(/^.*\//, '');
    const addons: string[] = Array.isArray(req.body?.addons) ? req.body.addons.map((a: any) => String(a).replace(/^.*\//, '')) : [];
    const customName = String(req.body?.name || '').slice(0, 120);
    if (!baseSlug || !customName) return res.status(400).json({ error: 'base_slug and name required' });

    const { data: base } = await supabase.from('playbooks')
      .select('*').eq('slug', baseSlug).order('version', { ascending: false }).limit(1).maybeSingle();
    if (!base) return res.status(404).json({ error: `base playbook "${baseSlug}" not found` });

    const addonRows = addons.length
      ? (await supabase.from('playbooks')
          .select('*').in('slug', addons).eq('workflow_type', 'addon')
          .order('version', { ascending: false })).data || []
      : [];

    const stages = [
      ...(Array.isArray(base.stages_json) ? base.stages_json : []),
      ...addonRows.flatMap(a => (Array.isArray(a.stages_json) ? a.stages_json : [])),
    ];
    const tasks = [
      ...(Array.isArray(base.tasks_json) ? base.tasks_json : []),
      ...addonRows.flatMap(a => (Array.isArray(a.tasks_json) ? a.tasks_json : [])),
    ];
    const gates = [
      ...(Array.isArray(base.gates_json) ? base.gates_json : []),
      ...addonRows.flatMap(a => (Array.isArray(a.gates_json) ? a.gates_json : [])),
    ];
    const total = Number(base.metadata?.price_inr || 0)
      + addonRows.reduce((s, a) => s + Number(a.metadata?.price_inr || 0), 0);

    // Versioned custom slug: base + addons hash → unique per combo
    const comboSlug = `custom-${baseSlug}${addons.length ? '-' + addons.join('+') : ''}`.replace(/[^a-z0-9+-]/gi, '-').slice(0, 100);
    // Next version for this combo
    const { data: existing } = await supabase.from('playbooks')
      .select('version').eq('slug', comboSlug).order('version', { ascending: false }).limit(1);
    const nextVersion = (existing && existing.length ? Number(existing[0].version) : 0) + 1;

    const { data: saved, error } = await supabase.from('playbooks').insert({
      slug: comboSlug,
      name: customName,
      workflow_type: 'custom',
      version: nextVersion,
      description: `${customName} — ${base.name}${addonRows.length ? ' + ' + addonRows.length + ' add-ons' : ''}. ₹${total}.`,
      stages_json: stages,
      tasks_json: tasks,
      gates_json: gates,
      metadata: {
        price_inr: total,
        billing: base.metadata?.billing || 'one_time',
        base_slug: baseSlug,
        addons,
        designed_via: 'package-designer',
      },
    }).select().single();
    if (error) {
      // Unique violation on exact same version → bump handled above; anything else is real.
      return res.status(500).json({ error: `save failed: ${error.message}` });
    }
    res.status(201).json({ ok: true, playbook: { slug: saved.slug, name: saved.name, version: saved.version, price_inr: total }, install_url: `/api/v1/playbooks/${encodeURIComponent(saved.slug)}/install` });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
