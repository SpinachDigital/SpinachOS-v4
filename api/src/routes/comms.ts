/*
 * routes/comms.ts — Phase 3 monolith split (from index.ts L3095–3250).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, broadcast, emitFeed, sanitizeText, supabase } from '../ctx';
app.get('/api/v1/comms/channels', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('channels')
      .select('*')
      .eq('is_archived', false)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/comms/channels', authMiddleware, async (req, res) => {
  try {
    const { name, display_name, description, channel_type, created_by } = req.body;
    if (!name || !display_name) return res.status(400).json({ error: 'Missing name or display_name' });
    const { data, error } = await supabase
      .from('channels')
      .insert({
        name,
        display_name,
        description: description || null,
        channel_type: channel_type || 'public',
        created_by: created_by || 'director',
      })
      .select()
      .single();
    if (error) throw error;
    emitFeed('system', 'Channel created', { channel: name });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/comms/threads', authMiddleware, async (req, res) => {
  try {
    const { channel_id, status } = req.query;
    let query = supabase.from('threads').select('*');
    if (channel_id) query = query.eq('channel_id', channel_id);
    if (status) query = query.eq('status', status);
    const { data, error } = await query.order('updated_at', { ascending: false }).limit(100);
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/comms/threads', authMiddleware, async (req, res) => {
  try {
    const { channel_id, title, thread_type, created_by_type, created_by_id, related_entity_type, related_entity_id } = req.body;
    if (!channel_id) return res.status(400).json({ error: 'Missing channel_id' });
    const { data, error } = await supabase
      .from('threads')
      .insert({
        channel_id,
        title: title || null,
        thread_type: thread_type || 'discussion',
        created_by_type: created_by_type || 'human',
        created_by_id: created_by_id || 'director',
        related_entity_type: related_entity_type || null,
        related_entity_id: related_entity_id || null,
      })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/comms/messages', authMiddleware, async (req, res) => {
  try {
    const { channel_id, thread_id, limit } = req.query;
    let query = supabase.from('messages').select('*');
    if (channel_id) query = query.eq('channel_id', channel_id);
    if (thread_id) query = query.eq('thread_id', thread_id);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(parseInt((limit as string) || '100'));
    if (error) throw error;
    res.json((data || []).reverse());
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/comms/messages', authMiddleware, async (req, res) => {
  try {
    const { channel_id, thread_id, sender_type, sender_id, message_type, mentions, reply_to_id } = req.body;
    // XSS sanitization: strip HTML/JS injection before persisting (Telegram bot + all consumers get clean text)
    const content = sanitizeText(req.body.content);
    if (!content || (!channel_id && !thread_id)) {
      return res.status(400).json({ error: 'Missing content or channel_id/thread_id' });
    }
    const safeMentions = Array.isArray(mentions)
      ? mentions.slice(0, 20).map((m: unknown) => sanitizeText(m, 100)).filter(Boolean)
      : [];
    const { data, error } = await supabase
      .from('messages')
      .insert({
        channel_id: channel_id || null,
        thread_id: thread_id || null,
        sender_type: sender_type === 'agent' || sender_type === 'system' ? sender_type : 'human',
        sender_id: sanitizeText(sender_id, 100) || 'director',
        content,
        message_type: message_type || 'text',
        mentions: safeMentions,
        reply_to_id: reply_to_id || null,
      })
      .select()
      .single();
    if (error) throw error;
    // Bump thread updated_at
    if (thread_id) {
      await supabase.from('threads').update({ updated_at: new Date().toISOString() }).eq('id', thread_id);
    }
    broadcast('message', { ...data, event_type: 'message' });
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Seed default channels (idempotent)
app.post('/api/v1/comms/seed', authMiddleware, async (req, res) => {
  try {
    const defaults = [
      { name: 'general', display_name: '#general', description: 'Company-wide announcements and chatter', channel_type: 'public' },
      { name: 'approvals', display_name: '#approvals', description: 'Approval requests and decisions', channel_type: 'announcement' },
      { name: 'engineering', display_name: '#engineering', description: 'Engineering coordination', channel_type: 'public' },
      { name: 'marketing', display_name: '#marketing', description: 'Campaigns and content', channel_type: 'public' },
      { name: 'random', display_name: '#random', description: 'Off-topic', channel_type: 'public' },
    ];
    const created = [];
    for (const ch of defaults) {
      const { data, error } = await supabase
        .from('channels')
        .upsert({ ...ch, created_by: 'director' }, { onConflict: 'name' })
        .select()
        .single();
      if (!error && data) created.push(data);
    }
    res.json({ success: true, channels: created });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// WEB SCRAPER — multi-source lead gen
// ============================================
