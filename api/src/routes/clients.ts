/*
 * routes/clients.ts — Phase 3 monolith split (from index.ts L893–1169).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, broadcast, emitAgentState, emitFeed, emitWorkflow, supabase } from '../ctx';
import { executeAgentTask } from '../engines/agent-execution';
import { PACKAGE_PRESETS } from '../clients-presets';
import { hibernateDormantAgent, provisionDormantAgent } from '../dormant';
app.post('/api/v1/clients', authMiddleware, async (req, res) => {
  const { name, industry, location, contact_person, email, phone, goal, status, services, metadata = {} } = req.body;
  
  // Map incoming fields to database schema
  const clientData = {
    name,
    business_type: industry || '',
    location: location || '',
    services: Array.isArray(services) ? services : (services ? [services] : []),
    goal: goal || '',
    status: status || 'active',
    metadata: {
      ...metadata,
      contact_person,
      email,
      phone
    }
  };
  
  const { data, error } = await supabase.from('clients').insert(clientData).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.get('/api/v1/clients', authMiddleware, async (req, res) => {
  const { status } = req.query;
  let query = supabase.from('clients').select('*');
  if (status) query = query.eq('status', status);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/v1/clients/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.rpc('get_client_full_context', { p_client_id: req.params.id });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ============================================================
// PART E3 — PACKAGES + ONBOARDING + DORMANT TRIGGER
// ============================================================

// In-code package presets — source of truth when the packages table isn't applied yet.
// Mirrors supabase/migration-v6-hierarchy.sql exactly.

// GET /api/v1/packages — 4 presets (DB first, in-code fallback)
app.get('/api/v1/packages', authMiddleware, async (_req, res) => {
  const { data, error } = await supabase.from('packages').select('*').eq('is_active', true);
  if (!error && data && data.length > 0) return res.json(data);
  // packages table missing or empty → in-code presets
  res.json(Object.values(PACKAGE_PRESETS));
});

// Dormant activation / hibernation — the ads_manager trigger (Part B).
// activate: flips is_dormant→false, emits "Paid Media department online".
// hibernate: only when NO active scale/ads clients remain.


// POST /api/v1/onboard — the Part E3 onboarding endpoint.
// Body: { name, package_key, has_logo, industry?, location?, contact?, email?, goal?, intake_notes? }
// Flow: client row (package_key + has_logo + intake_notes) → dormant trigger (scale→ads_manager)
//       → workflow auto-start with package steps → strategy bypass note when needed.
app.post('/api/v1/onboard', authMiddleware, async (req, res) => {
  const { name, package_key, has_logo = false, industry, location, contact, email, goal, intake_notes } = req.body;
  if (!name || !package_key) return res.status(400).json({ error: 'name and package_key required' });
  const preset = PACKAGE_PRESETS[package_key];
  if (!preset) return res.status(400).json({ error: `unknown package_key: ${package_key}. Use: ${Object.keys(PACKAGE_PRESETS).join(', ')}` });

  // 1. Client row — package linkage + brand branch fields
  const clientData: any = {
    name,
    business_type: industry || '',
    location: location || '',
    goal: goal || '',
    status: 'active',
    services: [preset.name],
    metadata: { contact_person: contact, email, package_key, has_logo, intake_notes },
  };
  // Optional columns — ignore errors if migration not applied (graceful)
  const { data: client, error: clientErr } = await supabase.from('clients').insert(clientData).select().single();
  if (clientErr) return res.status(500).json({ error: `client insert failed: ${clientErr.message}` });

  // 2. Package linkage (column exists only post-migration)
  let packageLinked = false;
  if (client) {
    const { data: pkg } = await supabase.from('packages').select('id').eq('key', package_key).maybeSingle();
    if (pkg) {
      const { error: linkErr } = await supabase.from('clients').update({ package_id: pkg.id, has_logo, intake_notes: intake_notes || '' }).eq('id', client.id);
      packageLinked = !linkErr;
    }
  }

  // 3. DORMANT TRIGGER — scale package (or ads add-on) provisions ads_manager
  let dormant: any = { triggered: false };
  if (package_key === 'scale' || req.body.ads_addon === true) {
    dormant = await provisionDormantAgent('ads_manager');
  }

  // 4. Workflow auto-start with package-specific steps
  const steps = preset.steps.map((s: any, i: number) => ({
    ...s,
    description: STEP_DESCRIPTIONS[s.name] || s.name.replace(/_/g, ' '),
    status: i === 0 ? 'in_progress' : 'pending',
    started_at: i === 0 ? new Date().toISOString() : null,
  }));
  const workflowPayload = {
    name: `${preset.name} — ${name}`,
    client_id: client.id,
    current_step: steps[0]?.name || null,
    steps_json: steps,
    metadata: { package_key, has_logo, brand_branch: has_logo ? 'dna_from_logo' : 'code_drawn_svg' },
  };
  const { data: workflow, error: wfErr } = await supabase.from('workflows').insert(workflowPayload).select().single();
  if (wfErr) return res.status(500).json({ error: `workflow insert failed: ${wfErr.message}` });

  emitWorkflow(workflow);
  emitFeed('orchestrator', 'INTAKE', { client: name, package: preset.name, has_logo });
  emitAgentState('orchestrator', 'working', `Onboarding ${name} (${preset.name})`);

  // 5. Kick off step 1 via the execution bridge (async, don't block response)
  executeAgentTask('orchestrator', `Onboard client "${name}" (${preset.name} package, has_logo=${has_logo}). Break this intake into department tasks with briefs.`, 'onboarding-e3', 'strategy')
    .catch((e: any) => console.error('[onboard] step-1 dispatch failed:', e?.message));

  res.status(201).json({
    client,
    package: { key: preset.key, name: preset.name, price_inr: preset.price_inr, billing: preset.billing },
    workflow,
    dormant_trigger: dormant,
    package_linked: packageLinked,
    brand_branch: has_logo ? 'dna_from_logo' : 'code_drawn_svg',
    next: 'orchestrator planning department tasks — watch Live Activity',
  });
});

// POST /api/v1/clients/:id/churn — hibernation path: when the last ads client churns
app.post('/api/v1/clients/:id/churn', authMiddleware, async (req, res) => {
  const { data: client } = await supabase.from('clients').select('id, name, metadata').eq('id', req.params.id).maybeSingle();
  if (!client) return res.status(404).json({ error: 'client not found' });
  const { error: updErr } = await supabase.from('clients').update({ status: 'churned' }).eq('id', client.id);
  if (updErr) return res.status(500).json({ error: `churn failed: ${updErr.message} (run migration-v6-hierarchy.sql to allow 'churned' status)`, ads_hibernation: { hibernated: false, reason: 'client still active' } });
  const wasScale = (client.metadata as any)?.package_key === 'scale';
  const hib = wasScale ? await hibernateDormantAgent('ads_manager') : { hibernated: false, reason: 'not a scale client' };
  emitFeed('sales', 'CHURNED', { client: client.name });
  res.json({ ok: true, client_id: client.id, ads_hibernation: hib });
});

// Human-readable step descriptions for workflow UI
const STEP_DESCRIPTIONS: Record<string, string> = {
  intake: 'Intake notes → client row + RAG',
  classify: 'Laya classification → orchestrator routing',
  dna_extract: 'Extract brand DNA from logo (or create fresh)',
  logo_design: '3 code-drawn SVG logo concepts',
  guidelines: 'Brand guidelines document',
  hod_qa: 'HOD QA against brand DNA',
  strategy: 'Growth strategy & positioning',
  website: 'Website build & deploy',
  content: 'Content plan & copy',
  seo_setup: 'Technical SEO + GMB setup',
  gmb: 'Google Business Profile optimization',
  content_plan: 'Monthly content plan',
  content_creation: 'Produce the content',
  design_assets: 'Design the assets',
  seo_check: 'SEO check + rankings snapshot',
  ads_manage: 'Paid media management (spend-guard)',
  monthly_report: 'Monthly report (references last month)',
  approve: 'Director approval gate',
  deliver: 'Deliver to client',
};

// ============================================================
// PART E4 — RAG (knowledge_chunks): ingest + query.
// Lexical tsvector search today; pgvector slot ready (embedding JSONB
// column exists — swap to vector type + HNSW when OmniRoute gains an
// embedding provider). Client isolation enforced: client-scoped queries
// can never see agency-only or other-client chunks.
// ============================================================

// POST /api/v1/knowledge/ingest — add a chunk (auto or manual)
