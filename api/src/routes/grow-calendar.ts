// Phase 10 GOAL 1 — Content Calendar API (CRUD)
// Contract:
//   GET  /api/v1/grow/calendar?from=ISO&to=ISO -> [{ id, title, channel, status, scheduled_for }]
//   POST /api/v1/grow/items { title, channel, body_text? } -> 201 { id, status: 'idea' }
//   PATCH /api/v1/grow/items/:id { title?, body_text?, channel?, scheduled_for? } -> 200 item
//   DELETE /api/v1/grow/items/:id -> 200 { ok: true } (only idea/draft)

import { app, supabase, authMiddleware } from '../ctx';

const GROW_API = '/api/v1/grow';

// ---------- Calendar: GET /api/v1/grow/calendar?from=&to= ----------
app.get(GROW_API + '/calendar', authMiddleware, async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = supabase
      .from('content_items')
      .select('id, title, channel, status, scheduled_for, style_score')
      .order('scheduled_for', { ascending: true, nullsFirst: false });

    if (from) query = query.gte('scheduled_for', from);
    if (to) query = query.lte('scheduled_for', to);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- POST /api/v1/grow/items (founder creates idea/draft) ----------
app.post(GROW_API + '/items', authMiddleware, async (req, res) => {
  try {
    const { title, channel, body_text } = req.body || {};
    if (!title?.trim() || !channel) {
      return res.status(400).json({ error: 'title and channel required' });
    }
    if (!['x', 'linkedin', 'instagram', 'blog'].includes(channel)) {
      return res.status(400).json({ error: 'channel must be x|linkedin|instagram|blog' });
    }

    const { data, error } = await supabase
      .from('content_items')
      .insert({
        title: title.trim(),
        channel,
        body_text: body_text?.trim() || null,
        status: 'idea',
        created_by: 'founder',
      })
      .select('id, status')
      .single();

    if (error) throw error;
    res.status(201).json({ id: data.id, status: data.status });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- PATCH /api/v1/grow/items/:id (edit draft fields, reschedule) ----------
app.patch(GROW_API + '/items/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, body_text, channel, scheduled_for } = req.body || {};

    // Validate status: only idea/draft can be edited
    const { data: item, error: fetchErr } = await supabase
      .from('content_items')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchErr || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (!['idea', 'draft'].includes(item.status)) {
      return res.status(400).json({ error: `Cannot edit item in status: ${item.status}` });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (title?.trim()) updates.title = title.trim();
    if (body_text !== undefined) updates.body_text = body_text?.trim() || null;
    if (channel) {
      if (!['x', 'linkedin', 'instagram', 'blog'].includes(channel)) {
        return res.status(400).json({ error: 'channel must be x|linkedin|instagram|blog' });
      }
      updates.channel = channel;
    }
    if (scheduled_for !== undefined) updates.scheduled_for = scheduled_for;

    const { data, error } = await supabase
      .from('content_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- DELETE /api/v1/grow/items/:id (only idea/draft) ----------
app.delete(GROW_API + '/items/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: item, error: fetchErr } = await supabase
      .from('content_items')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchErr || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (!['idea', 'draft'].includes(item.status)) {
      return res.status(400).json({ error: `Cannot delete item in status: ${item.status}` });
    }

    const { error } = await supabase.from('content_items').delete().eq('id', id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});