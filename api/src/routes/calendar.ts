/*
 * routes/calendar.ts — Phase 3 monolith split (from index.ts L2919–3094).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitFeed, supabase } from '../ctx';
app.get('/api/v1/calendar/events', authMiddleware, async (req, res) => {
  try {
    const { calendar_id, start, end, status } = req.query;
    let query = supabase.from('events').select('*, calendars!inner(*)');
    if (calendar_id) query = query.eq('calendar_id', calendar_id);
    if (start) query = query.gte('start_time', start as string);
    if (end) query = query.lte('end_time', end as string);
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('start_time', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/calendar/events', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('events').insert(req.body).select().single();
    if (error) throw error;
    emitFeed('system', 'Calendar event created', { event_id: data.id });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/v1/calendar/events/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('events').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/v1/calendar/events/:id', authMiddleware, async (req, res) => {
  try {
    const { error } = await supabase.from('events').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/calendar/calendars', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('calendars').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/calendar/calendars', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('calendars').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/calendar/agent-schedule/:profile', authMiddleware, async (req, res) => {
  try {
    const { data: calendar } = await supabase
      .from('calendars')
      .select('id')
      .eq('owner_type', 'agent')
      .eq('owner_id', req.params.profile)
      .eq('is_default', true)
      .single();
    
    if (!calendar) {
      return res.json({ events: [], calendar: null });
    }
    
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('calendar_id', calendar.id)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(50);
    
    if (error) throw error;
    res.json({ events: events || [], calendar });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/calendar/standup', authMiddleware, async (req, res) => {
  try {
    // Create standup events for all active agents
    const { data: agents } = await supabase.from('agent_states').select('profile').neq('state', 'idle');
    const today = new Date();
    today.setHours(9, 0, 0, 0); // 9 AM standup
    const endTime = new Date(today.getTime() + 30 * 60000); // 30 min

    // DEDUPE: skip events already scheduled for this standup window (same day, 9AM ±1h)
    const windowStart = new Date(today.getTime() - 60 * 60000).toISOString();
    const windowEnd = new Date(today.getTime() + 60 * 60000).toISOString();
    const { data: existing } = await supabase
      .from('events')
      .select('attendees')
      .eq('event_type', 'standup')
      .eq('status', 'scheduled')
      .gte('start_time', windowStart)
      .lte('start_time', windowEnd);
    const alreadyScheduled = new Set<string>();
    for (const ev of existing || []) {
      for (const a of (ev.attendees as any[]) || []) {
        if (a?.id) alreadyScheduled.add(a.id);
      }
    }

    let created = 0;
    let skipped = 0;
    // For each agent, find/create their calendar and create event
    for (const agent of agents || []) {
      if (alreadyScheduled.has(agent.profile)) {
        skipped++;
        continue;  // dedupe — one standup per agent per day
      }
      const { data: cal } = await supabase
        .from('calendars')
        .select('id')
        .eq('owner_type', 'agent')
        .eq('owner_id', agent.profile)
        .eq('is_default', true)
        .single();

      if (cal) {
        const { error: evErr } = await supabase.from('events').insert({
          calendar_id: cal.id,
          title: 'Daily Standup',
          description: '15-min sync: what did you do, what will you do, blockers',
          event_type: 'standup',
          start_time: today.toISOString(),
          end_time: endTime.toISOString(),
          all_day: false,
          status: 'scheduled',
          priority: 1,
          attendees: [{ type: 'agent', id: agent.profile }],
          related_entity_type: 'system',
          metadata: { auto_generated: true },
        });
        if (evErr) throw evErr;
        created++;
      }
    }

    emitFeed('orchestrator', 'Daily standup scheduled', {
      agent_count: agents?.length || 0, created, skipped,
    });
    res.json({
      success: true,
      message: created > 0
        ? `Standup scheduled for ${created} agent(s)` + (skipped ? ` — ${skipped} already scheduled (deduped)` : '')
        : `All ${skipped} agent(s) already have today's standup scheduled (deduped)`,
      created,
      skipped,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// INTERNAL COMMS — channels, threads, messages
// ============================================
