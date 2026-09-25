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
    const { date, platform, status, theme, limit } = req.query;
    let query = supabase.from('marketing_content_calendar').select('*');
    if (date) query = query.eq('date', date);
    if (platform) query = query.eq('platform', platform);
    if (status) query = query.eq('status', status);
    if (theme) query = query.eq('theme', theme);
    const { data, error } = await query
      .order('date', { ascending: true })
      .order('slot_index', { ascending: true })
      .limit(parseInt((limit as string) || '200'));
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/marketing/calendar', authMiddleware, async (req, res) => {
  try {
    const { date, slot_index, theme, platform, content_text, media_urls, scheduled_at } = req.body;
    if (!date || slot_index === undefined || !theme || !platform) {
      return res.status(400).json({ error: 'Missing date, slot_index, theme, or platform' });
    }
    const { data, error } = await supabase
      .from('marketing_content_calendar')
      .upsert({
        date, slot_index, theme, platform,
        content_text: content_text || null,
        media_urls: media_urls || [],
        scheduled_at: scheduled_at || null,
        status: req.body.status || 'planned',
      }, { onConflict: 'date,slot_index,platform' })
      .select()
      .single();
    if (error) throw error;
    emitFeed('social', 'Content scheduled', { date, slot: slot_index, platform });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/v1/marketing/calendar/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('marketing_content_calendar')
      .update(req.body)
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
    const { error } = await supabase.from('marketing_content_calendar').delete().eq('id', req.params.id);
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

        const { data, error } = await supabase
          .from('marketing_content_calendar')
          .upsert({
            date: dateStr,
            slot_index: slot,
            theme,
            platform: 'x',
            status: 'planned',
            scheduled_at: scheduled.toISOString(),
            metadata: { auto_generated: true },
          }, { onConflict: 'date,slot_index,platform' })
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


