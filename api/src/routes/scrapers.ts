/*
 * routes/scrapers.ts — Phase 3 monolith split (from index.ts L3251–3408).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitFeed, supabase } from '../ctx';
app.get('/api/v1/scraper/sources', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('scraper_sources').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/scraper/sources', authMiddleware, async (req, res) => {
  try {
    const { name, source_type, base_url, config, schedule_cron } = req.body;
    if (!name || !source_type) return res.status(400).json({ error: 'Missing name or source_type' });
    const { data, error } = await supabase
      .from('scraper_sources')
      .upsert({ name, source_type, base_url: base_url || null, config: config || {}, schedule_cron: schedule_cron || null }, { onConflict: 'name' })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Ingest scraped leads (called by scraper scripts after a run)
app.post('/api/v1/scraper/ingest', authMiddleware, async (req, res) => {
  try {
    const { source, run_id, leads } = req.body;
    if (!source || !Array.isArray(leads)) return res.status(400).json({ error: 'Missing source or leads array' });

    // Auto-create run record if not provided (so run history is always tracked)
    let effectiveRunId = run_id;
    if (!effectiveRunId) {
      const { data: sourceRow, error: sourceErr } = await supabase.from('scraper_sources').select('id').limit(1).single();
      let sourceId = sourceErr ? null : sourceRow?.id;
      if (sourceId) {
        const { data: run, error: runErr } = await supabase.from('scraper_runs').insert({ source_id: sourceId, status: 'running' }).select().single();
        effectiveRunId = runErr ? null : run?.id;
      }
    }

    let inserted = 0;
    let duplicates = 0;
    const errors = [];

    for (const lead of leads) {
      // Dedupe by email or company+name
      let existing: any = null;
      if (lead.email) {
        const { data } = await supabase.from('leads').select('id').eq('email', lead.email).limit(1);
        existing = data?.[0];
      } else if (lead.company && lead.name) {
        const { data } = await supabase.from('leads').select('id').eq('company', lead.company).eq('name', lead.name).limit(1);
        existing = data?.[0];
      }

      if (existing) {
        duplicates++;
        continue;
      }

      const { error } = await supabase.from('leads').insert({
        source: lead.source || source,
        name: lead.name || null,
        email: lead.email || null,
        phone: lead.phone || null,
        company: lead.company || null,
        role: lead.role || null,
        linkedin_url: lead.linkedin_url || null,
        status: 'new',
        score: lead.score || 0,
        metadata: { ...(lead.metadata || {}), scraper_run_id: run_id || null, raw_data: lead.raw_data || null },
      });
      if (error) errors.push({ lead: lead.name || lead.email, error: error.message });
      else inserted++;
    }

    // Update run record
    if (run_id) {
      await supabase.from('scraper_runs').update({
        status: errors.length === 0 ? 'completed' : 'partial',
        completed_at: new Date().toISOString(),
        leads_found: leads.length,
        leads_new: inserted,
        leads_updated: duplicates,
        errors,
      }).eq('id', run_id);
    }

    emitFeed('sales', 'Leads ingested', { source, new: inserted, duplicates, total: leads.length });
    res.json({ success: true, inserted, duplicates, errors: errors.length, total: leads.length });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Start a scrape run (creates run record; the actual scraping runs via Hermes cron/browser)
app.post('/api/v1/scraper/run/:sourceId', authMiddleware, async (req, res) => {
  try {
    const { data: source } = await supabase.from('scraper_sources').select('*').eq('id', req.params.sourceId).single();
    if (!source) return res.status(404).json({ error: 'Source not found' });

    const { data: run, error } = await supabase.from('scraper_runs').insert({
      source_id: source.id,
      status: 'running',
    }).select().single();
    if (error) throw error;

    await supabase.from('scraper_sources').update({ last_run_at: new Date().toISOString(), last_run_status: 'running' }).eq('id', source.id);

    emitFeed('sales', 'Scrape run started', { source: source.name, run_id: run.id });
    res.json({ success: true, run_id: run.id, source: source.name, hint: 'Run the scraper script for this source, then POST /api/v1/scraper/ingest with the leads' });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/scraper/runs', authMiddleware, async (req, res) => {
  try {
    const { source_id, limit } = req.query;
    let query = supabase.from('scraper_runs').select('*, scraper_sources(name, source_type)');
    if (source_id) query = query.eq('source_id', source_id);
    const { data, error } = await query.order('started_at', { ascending: false }).limit(parseInt((limit as string) || '20'));
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Seed default scraper sources (idempotent)
app.post('/api/v1/scraper/seed', authMiddleware, async (req, res) => {
  try {
    const defaults: Array<{ name: string; source_type: string; base_url: string | null; config: Record<string, any>; schedule_cron: string }> = [
      { name: 'github_trending', source_type: 'github', base_url: 'https://github.com/trending', config: { period: 'daily', language: 'any' }, schedule_cron: '0 6 * * *' },
      { name: 'hackernews_hiring', source_type: 'hackernews', base_url: 'https://news.ycombinator.com/sub?id=jobs', config: { thread: 'Ask HN: Who is hiring?' }, schedule_cron: '0 7 * * *' },
      { name: 'google_maps_local', source_type: 'google_maps', base_url: null, config: { queries: ['gyms', 'dental clinics', 'salons'], location: 'Mumbai' }, schedule_cron: '0 8 * * *' },
    ];
    const created = [];
    for (const s of defaults) {
      const { data, error } = await supabase
        .from('scraper_sources')
        .upsert(s, { onConflict: 'name' })
        .select()
        .single();
      if (!error && data) created.push(data);
    }
    res.json({ success: true, sources: created });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// TELEGRAM INTEGRATION
// ============================================
