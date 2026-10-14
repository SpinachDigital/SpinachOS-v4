/*
 * routes/marketing.ts — Phase 3 monolith split (from index.ts L3542–3724).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitFeed, supabase } from '../ctx';
import { AGENT_ICONS, DEPT_TAG_DEFS } from '../dashboard-helpers';
app.get('/api/v1/marketing/calendar', authMiddleware, async (req, res) => {
  try {
    const { date, platform, status, theme, limit: qLimit, offset: qOffset } = req.query;
    // §4 scale rule: limit default 20, max 100 + offset (calendar views request
    // their window explicitly; default stays bounded)
    const limit = Math.min(parseInt(String(qLimit)) || 20, 100);
    const offset = Math.max(parseInt(String(qOffset)) || 0, 0);
    // N2 §1 calendar unification: content_items is the ONE canonical calendar.
    // /marketing keeps its response shape (legacy fields) so its UI doesn't break:
    // rows are read from content_items, projected back into the legacy shape.
    const GROW_TO_LEGACY: Record<string, string> = { idea: 'planned', draft: 'drafting', review: 'drafting', scheduled: 'planned', approved: 'planned', published: 'published', failed: 'planned' };
    let query = supabase.from('content_items')
      .select('id, title, body_text, channel, status, scheduled_for, provider_post_id, published_at, metadata, created_at, updated_at');
    if (date) query = query.gte('scheduled_for', `${date}T00:00:00`).lte('scheduled_for', `${date}T23:59:59`);
    if (platform) query = query.eq('channel', platform);
    if (theme) query = query.contains('metadata', { theme });
    const { data, error } = await query
      .order('scheduled_for', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    // legacy filter on mapped status (post-read filter — bounded to `limit` rows)
    const rows = (data || [])
      .map((c: any) => ({
        id: c.id,
        date: (c.scheduled_for || c.created_at || '').slice(0, 10),
        slot_index: c.metadata?.slot_index ?? 0,
        theme: c.metadata?.theme || null,
        platform: c.channel,
        status: GROW_TO_LEGACY[c.status] || 'planned',
        content_text: c.body_text,
        media_urls: c.metadata?.media_urls || [],
        scheduled_at: c.scheduled_for,
        published_at: c.published_at || null,
        post_id: c.provider_post_id || null,
        engagement: c.metadata?.engagement || null,
        metadata: c.metadata || {},
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
    res.json(status ? rows.filter((r: any) => r.status === status) : rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/marketing/calendar', authMiddleware, async (req, res) => {
  try {
    const { date, slot_index, theme, platform, content_text, media_urls, scheduled_at } = req.body;
    if (!date || !theme || !platform) {
      return res.status(400).json({ error: 'Missing date, theme, or platform' });
    }
    // N2 §1: writes go to the canonical content_items table.
    const { data, error } = await supabase
      .from('content_items')
      .insert({
        title: content_text?.trim().slice(0, 60) || `${theme} post — ${date}`,
        channel: platform,
        body_text: content_text || null,
        scheduled_for: scheduled_at || `${date}T09:00:00`,
        status: 'idea',
        created_by: 'founder',
        metadata: { source_table: 'marketing_ui', theme, date, slot_index: slot_index ?? 0, media_urls: media_urls || [] },
      })
      .select()
      .single();
    if (error) throw error;
    emitFeed('social', 'Content scheduled', { date, slot: slot_index ?? 0, platform });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/v1/marketing/calendar/:id', authMiddleware, async (req, res) => {
  try {
    // N2 §1: patch the canonical row; map legacy field names back.
    const { content_text, status, scheduled_at, ...rest } = req.body || {};
    const update: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
    if (content_text !== undefined) update.body_text = content_text;
    if (scheduled_at !== undefined) update.scheduled_for = scheduled_at;
    const LEGACY_TO_GROW: Record<string, string> = { planned: 'idea', drafting: 'draft', published: 'published' };
    if (status !== undefined) update.status = LEGACY_TO_GROW[status] || status;
    const { data, error } = await supabase
      .from('content_items')
      .update(update)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/v1/marketing/calendar/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('content_items').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Generate a week of content plan (10 slots/day across themes)
app.post('/api/v1/marketing/calendar/generate-week', authMiddleware, async (req, res) => {
  try {
    const { start_date } = req.body;
    const start = start_date ? new Date(start_date) : new Date();
    start.setHours(0, 0, 0, 0);

    const themes = ['politics', 'cricket', 'ai', 'github', 'quote', 'gita'] as const;
    const slotTimes = ['09:00', '10:30', '12:00', '13:30', '14:30', '16:00', '17:30', '19:00', '20:30', '21:30'];
    const created = [];

    for (let day = 0; day < 7; day++) {
      const date = new Date(start);
      date.setDate(start.getDate() + day);
      const dateStr = date.toISOString().split('T')[0];

      for (let slot = 0; slot < 10; slot++) {
        const theme = themes[(day * 10 + slot) % themes.length];
        const [h, m] = slotTimes[slot].split(':').map(Number);
        const scheduled = new Date(date);
        scheduled.setHours(h, m, 0, 0);

        // N3 §0: writes go to content_items (canonical). The natural key
        // (date, slot_index, platform) is enforced in metadata via a
        // deterministic title; dedupe checked before insert (no unique
        // index exists on metadata, so upsert semantics are done manually).
        const mark = `weekgen:${dateStr}:${slot}:x`;
        const { data: existing } = await supabase
          .from('content_items')
          .select('id')
          .contains('metadata', { weekgen_key: mark })
          .limit(1);
        if (existing && existing.length) continue;
        const { data, error } = await supabase
          .from('content_items')
          .insert({
            title: `${theme} post — ${dateStr}`,
            channel: 'x',
            body_text: null,
            scheduled_for: scheduled.toISOString(),
            status: 'idea',
            created_by: 'founder',
            metadata: { auto_generated: true, weekgen_key: mark, date: dateStr, slot_index: slot, theme },
          })
          .select()
          .single();
        if (!error && data) created.push(data);
      }
    }

    emitFeed('social', 'Week plan generated', { days: 7, slots: created.length });
    res.json({ success: true, created: created.length, days: 7 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Engagement metrics
app.get('/api/v1/marketing/engagement', authMiddleware, async (req, res) => {
  try {
    const { platform, platform_post_id, metric_type, recorded_at, limit } = req.query;
    let query = supabase.from('marketing_engagement').select('*');
    if (platform) query = query.eq('platform', platform);
    if (platform_post_id) query = query.eq('platform_post_id', platform_post_id);
    if (metric_type) query = query.eq('metric_type', metric_type);
    if (recorded_at) {
      // Support gte. prefix (Supabase style)
      if (typeof recorded_at === 'string' && recorded_at.startsWith('gte.')) {
        query = query.gte('recorded_at', recorded_at.slice(4));
      } else {
        query = query.eq('recorded_at', recorded_at);
      }
    }
    const { data, error } = await query
      .order('recorded_at', { ascending: false })
      .limit(parseInt((limit as string) || '500'));
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Record engagement metrics (called by analytics scrapers / webhooks)
app.post('/api/v1/marketing/engagement', authMiddleware, async (req, res) => {
  try {
    const { platform, platform_post_id, metrics } = req.body;
    if (!platform || !platform_post_id || typeof metrics !== 'object') {
      return res.status(400).json({ error: 'Missing platform, platform_post_id, or metrics object' });
    }
    const rows = Object.entries(metrics).map(([metric_type, count]) => ({
      platform,
      platform_post_id,
      metric_type,
      count: Number(count) || 0,
      recorded_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase.from('marketing_engagement').insert(rows).select();
    if (error) throw error;
    emitFeed('social', 'Engagement recorded', { platform, post: platform_post_id.slice(0, 8), metrics });
    res.status(201).json({ success: true, recorded: data?.length || 0 });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// DASHBOARD BRIDGE — spinach-os.html adapter contract
// Maps the single-file command center UI to our real Supabase data.
// Shapes match DashPanels renderers exactly (API_CONTRACT.md).
// ============================================


