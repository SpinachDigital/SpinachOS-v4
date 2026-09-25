/*
 * routes/kanban.ts — Phase 3 monolith split (from index.ts L710–778).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, DANGEROUS_PROTO_RE, EVENT_HANDLER_RE, HTML_TAG_RE, authMiddleware, emitTaskUpdate, sanitizeText, supabase } from '../ctx';
app.get('/api/v1/kanban/boards', authMiddleware, async (req, res) => {
  try {
    const boards = [
      { id: 'strategy', name: 'Strategy', columns: ['ideas', 'approved', 'in_progress', 'review', 'done'] },
      { id: 'research', name: 'Research', columns: ['todo', 'running', 'review', 'done'] },
      { id: 'social', name: 'Social', columns: ['drafts', 'pending_approval', 'scheduled', 'published'] },
      { id: 'engineering', name: 'Engineering', columns: ['backlog', 'in_progress', 'review', 'deployed'] },
      { id: 'operations', name: 'Operations', columns: ['pending', 'in_progress', 'completed'] },
    ];
    res.json(boards);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/kanban/cards', authMiddleware, async (req, res) => {
  try {
    const { data } = await supabase.from('tasks').select('*').order('created_at', { ascending: false }).limit(100);
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/kanban/cards', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('tasks').insert(req.body).select().single();
    if (error) throw error;
    emitTaskUpdate(data);
    res.status(201).json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/v1/kanban/cards/:id', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('tasks').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    emitTaskUpdate(data);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// INPUT SANITIZATION — strip HTML/script injection before persisting
// ============================================

/** Sanitize user-supplied text: strips HTML tags, dangerous protocols, inline event handlers. */

// ============================================
// APPROVALS
// ============================================
// P1 Task 2 — full approval history with filters (client 360 + audit views)
// GET /api/v1/approvals?client_id=&status=&limit=
