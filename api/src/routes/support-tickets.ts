// Phase 9 GOAL 1 — Support Tickets API
// Client routes (portal) + Founder routes (inbox/work view)

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabase, emitFeed, authMiddleware, app } from '../ctx';
import { clientAuthMiddleware, ClientCtx } from './portal';
import { ticketInboxCard, closeTicketInboxCard } from '../ticket-inbox';

const router = { get: (p: string, ...h: any[]) => (app as any).get('/api/v1' + p, ...h), post: (p: string, ...h: any[]) => (app as any).post('/api/v1' + p, ...h) } as any;

// ---------- Client-scoped Supabase ----------
// Use global service client + explicit client_id filter on every query (RLS policies
// use client_id_claim() which needs JWT — service role bypasses RLS, so we enforce
// client isolation in code via .eq('client_id', clientId) on every query).
function clientSupabase(token: string, clientId: string): SupabaseClient {
  // Just return the global supabase client (service role) — we'll filter manually.
  // The `token` and `clientId` are unused but kept for signature compatibility.
  return supabase;
}

// ---------- Rate limit helpers (in-memory for now; Redis in prod) ----------
const ticketRateLimit = new Map<string, { count: number; resetAt: number }>();
const messageRateLimit = new Map<string, { count: number; resetAt: number }>();

function checkTicketRateLimit(clientId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `tickets:${clientId}`;
  const entry = ticketRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    ticketRateLimit.set(key, { count: 1, resetAt: now + 3600_000 }); // 1 hour
    return { allowed: true };
  }
  if (entry.count >= 10) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

function checkMessageRateLimit(ticketId: string, author: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `messages:${ticketId}:${author}`;
  const entry = messageRateLimit.get(key);
  if (!entry || now > entry.resetAt) {
    messageRateLimit.set(key, { count: 1, resetAt: now + 3600_000 }); // 1 hour
    return { allowed: true };
  }
  if (entry.count >= 30) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { allowed: true };
}

// ============================================================
// CLIENT ROUTES (portal) — clientAuthMiddleware (RLS-scoped)
// ============================================================

// POST /api/v1/portal/tickets { subject, body, priority? } -> 201 { id, status: 'open' }
router.post('/portal/tickets', clientAuthMiddleware, async (req: Request, res: Response) => {
  const client = (req as any).client as ClientCtx;
  const { subject, body, priority = 'normal' } = req.body || {};
  if (!subject?.trim() || !body?.trim()) {
    return res.status(400).json({ error: 'subject and body required' });
  }
  if (!['low', 'normal', 'high'].includes(priority)) {
    return res.status(400).json({ error: 'priority must be low|normal|high' });
  }

  // Rate limit: 10 tickets/hour per client
  const rl = checkTicketRateLimit(client.client_id);
  if (!rl.allowed) {
    return res.status(429).json({ error: `Rate limited — try again in ${rl.retryAfter}s` });
  }

  const sb = clientSupabase(client.session_token, client.client_id);

  // Create ticket
  const { data: ticket, error } = await sb
    .from('support_tickets')
    .insert({
      client_id: client.client_id,
      subject: subject.trim(),
      status: 'open',
      priority,
      unread_client: false,
      unread_founder: true,
    })
    .select('id, status')
    .single();

  if (error) {
    console.error('[portal:tickets:create] insert error:', error.message);
    return res.status(500).json({ error: 'Could not create ticket' });
  }

  // Create first message (from client)
  const { error: msgErr } = await sb
    .from('ticket_messages')
    .insert({ ticket_id: ticket.id, author: 'client', body: body.trim() });

  if (msgErr) {
    console.error('[portal:tickets:create] message insert error:', msgErr.message);
    // Ticket created but message failed — not ideal but ticket exists
  }

  // Founder feed event + INBOX card (GOAL 2: the golden rule — client voice
  // enters THE INBOX as a triaged card; one ticket = one card, dedupe on id).
  void (async () => {
    const { data: clientRow } = await supabase.from('clients').select('name').eq('id', client.client_id).single();
    await ticketInboxCard(
      { id: ticket.id, subject, priority, client_id: client.client_id },
      body.trim(),
      (clientRow as any)?.name || null,
    );
  })();
  emitFeed('support', 'new_ticket', {
    ticket_id: ticket.id,
    client_id: client.client_id,
    subject,
    priority,
  });

  return res.status(201).json({ id: ticket.id, status: ticket.status });
});

// GET /api/v1/portal/tickets -> 200 [{ id, subject, status, priority, updated_at, unread }]
router.get('/portal/tickets', clientAuthMiddleware, async (req: Request, res: Response) => {
  const client = (req as any).client as ClientCtx;
  const sb = clientSupabase(client.session_token, client.client_id);

  const { data, error } = await sb
    .from('support_tickets')
    .select('id, subject, status, priority, updated_at, unread_client')
    .eq('client_id', client.client_id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[portal:tickets:list] select error:', error.message);
    return res.status(500).json({ error: 'Could not load tickets' });
  }

  return res.json(
    (data || []).map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      updated_at: t.updated_at,
      unread: t.unread_client,
    }))
  );
});

// GET /api/v1/portal/tickets/:id -> 200 { id, subject, status, priority, messages: [...] }
// Marks unread_client = false on read
router.get('/portal/tickets/:id', clientAuthMiddleware, async (req: Request, res: Response) => {
  const client = (req as any).client as ClientCtx;
  const { id } = req.params;
  const sb = clientSupabase(client.session_token, client.client_id);

  // Fetch ticket (RLS ensures ownership)
  const { data: ticket, error: ticketErr } = await sb
    .from('support_tickets')
    .select('id, subject, status, priority, unread_client')
    .eq('id', id)
    .eq('client_id', client.client_id)
    .single();

  if (ticketErr || !ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  // Fetch messages
  const { data: messages, error: msgErr } = await sb
    .from('ticket_messages')
    .select('id, author, body, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  if (msgErr) {
    console.error('[portal:tickets:detail] messages error:', msgErr.message);
    return res.status(500).json({ error: 'Could not load messages' });
  }

  // Mark as read for client
  if (ticket.unread_client) {
    await sb.from('support_tickets').update({ unread_client: false }).eq('id', id);
  }

  return res.json({
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    unread: ticket.unread_client,
    messages: (messages || []).map((m) => ({
      id: m.id,
      author: m.author,
      body: m.body,
      created_at: m.created_at,
    })),
  });
});

// POST /api/v1/portal/tickets/:id/messages { body } -> 201 { id }
// Only on own tickets; closed tickets -> 403
router.post('/portal/tickets/:id/messages', clientAuthMiddleware, async (req: Request, res: Response) => {
  const client = (req as any).client as ClientCtx;
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body?.trim()) {
    return res.status(400).json({ error: 'body required' });
  }

  const sb = clientSupabase(client.session_token, client.client_id);

  // Verify ticket ownership and status
  const { data: ticket, error: ticketErr } = await sb
    .from('support_tickets')
    .select('id, status, unread_founder')
    .eq('id', id)
    .eq('client_id', client.client_id)
    .single();

  if (ticketErr || !ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (ticket.status === 'closed') {
    return res.status(403).json({ error: 'Ticket is closed — reply to reopen' });
  }

  // Rate limit: 30 messages/hour per ticket per author
  const rl = checkMessageRateLimit(id, 'client');
  if (!rl.allowed) {
    return res.status(429).json({ error: `Too many messages — wait ${rl.retryAfter}s` });
  }

  // Insert message
  const { data: msg, error: msgErr } = await sb
    .from('ticket_messages')
    .insert({ ticket_id: id, author: 'client', body: body.trim() })
    .select('id')
    .single();

  if (msgErr) {
    console.error('[portal:tickets:message] insert error:', msgErr.message);
    return res.status(500).json({ error: 'Could not send message' });
  }

  // Update ticket: unread_founder = true, status back to open if resolved
  const newStatus = ticket.status === 'resolved' ? 'open' : ticket.status;
  await sb
    .from('support_tickets')
    .update({ unread_founder: true, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  // GOAL 5: client reply → inbox card re-surfaces (bump, not duplicate).
  void ticketInboxCard({ id, subject: '', priority: 'normal', client_id: client.client_id }, '', null);

  // Feed event
  emitFeed('support', 'client_reply', {
    ticket_id: id,
    client_id: client.client_id,
  });

  return res.status(201).json({ id: msg.id });
});

// ============================================================
// FOUNDER ROUTES — authMiddleware (director role)
// ============================================================

// GET /api/v1/tickets?status=&client_id=&priority= -> 200 list
// Marks unread_founder = false on read of a ticket (not list)
router.get('/tickets', authMiddleware, async (req: Request, res: Response) => {
  const { status, client_id, priority } = req.query;
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  let query = sb
    .from('support_tickets')
    .select('id, client_id, subject, status, priority, updated_at, unread_founder')
    .order('updated_at', { ascending: false });

  if (status) query = query.eq('status', status);
  if (client_id) query = query.eq('client_id', client_id);
  if (priority) query = query.eq('priority', priority);

  const { data, error } = await query;

  if (error) {
    console.error('[founder:tickets:list] select error:', error.message);
    return res.status(500).json({ error: 'Could not load tickets' });
  }

  // Client names in one read (no embed — type-safe)
  const clientIds = [...new Set((data || []).map((t: any) => t.client_id))];
  const { data: clientRows } = await sb.from('clients').select('id, name').in('id', clientIds.length ? clientIds : ['00000000-0000-0000-0000-000000000000']);
  const nameById = new Map((clientRows || []).map((c: any) => [c.id, c.name]));

  return res.json(
    (data || []).map((t: any) => ({
      id: t.id,
      client_id: t.client_id,
      client_name: nameById.get(t.client_id) || 'Unknown',
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      updated_at: t.updated_at,
      unread: t.unread_founder,
    }))
  );
});

// POST /api/v1/tickets/:id/messages { body } -> 201 { id }
// Sets unread_client = true
router.post('/tickets/:id/messages', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { body } = req.body || {};
  if (!body?.trim()) {
    return res.status(400).json({ error: 'body required' });
  }

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Verify ticket exists
  const { data: ticket, error: ticketErr } = await sb
    .from('support_tickets')
    .select('id, status, client_id, unread_client')
    .eq('id', id)
    .single();

  if (ticketErr || !ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  if (ticket.status === 'closed') {
    return res.status(403).json({ error: 'Ticket is closed — reopen first' });
  }

  // Rate limit: 30 messages/hour per ticket per author
  const rl = checkMessageRateLimit(id, 'founder');
  if (!rl.allowed) {
    return res.status(429).json({ error: `Too many messages — wait ${rl.retryAfter}s` });
  }

  // Insert message
  const { data: msg, error: msgErr } = await sb
    .from('ticket_messages')
    .insert({ ticket_id: id, author: 'founder', body: body.trim() })
    .select('id')
    .single();

  if (msgErr) {
    console.error('[founder:tickets:message] insert error:', msgErr.message);
    return res.status(500).json({ error: 'Could not send message' });
  }

  // Update ticket: unread_client = true, status back to open if resolved
  const newStatus = ticket.status === 'resolved' ? 'open' : ticket.status;
  await sb
    .from('support_tickets')
    .update({ unread_client: true, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  // Feed event
  emitFeed('support', 'founder_reply', {
    ticket_id: id,
    client_id: ticket.client_id,
  });

  return res.status(201).json({ id: msg.id });
});

// POST /api/v1/tickets/:id/status { status } -> 200
// Valid transitions: open<->in_progress->resolved->closed; closed->open allowed
router.post('/tickets/:id/status', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};
  const validStatuses = ['open', 'in_progress', 'resolved', 'closed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'status must be open|in_progress|resolved|closed' });
  }

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: ticket, error: ticketErr } = await sb
    .from('support_tickets')
    .select('id, status, client_id')
    .eq('id', id)
    .single();

  if (ticketErr || !ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const current = ticket.status;
  const allowed: Record<string, string[]> = {
    open: ['in_progress', 'resolved', 'closed'],
    in_progress: ['open', 'resolved', 'closed'],
    resolved: ['closed', 'open'], // reopen
    closed: ['open'], // reopen
  };

  if (!allowed[current]?.includes(status)) {
    return res.status(400).json({ error: `Cannot transition from ${current} to ${status}` });
  }

  const { error: updErr } = await sb
    .from('support_tickets')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updErr) {
    console.error('[founder:tickets:status] update error:', updErr.message);
    return res.status(500).json({ error: 'Could not update status' });
  }

  // Feed event
  emitFeed('support', 'status_change', {
    ticket_id: id,
    client_id: ticket.client_id,
    from: current,
    to: status,
  });

  // GOAL 2/5: status changes update the inbox card (close it when resolved/closed).
  if (status === 'resolved' || status === 'closed') {
    await sb.from('support_tickets').update({ unread_founder: false, unread_client: false }).eq('id', id);
    void closeTicketInboxCard(id);
  }

  return res.json({ ok: true, status });
});

// GET /api/v1/tickets/:id -> 200 { id, subject, status, priority, client_id, client_name, messages: [...] }
// Marks unread_founder = false on read
router.get('/tickets/:id', authMiddleware, async (req: Request, res: Response) => {
  const { id } = req.params;
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: ticket, error: ticketErr } = await sb
    .from('support_tickets')
    .select('id, client_id, subject, status, priority, unread_founder')
    .eq('id', id)
    .single();

  if (ticketErr || !ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  // Client name (separate read — the embed adds a type we don't need)
  const { data: clientRow } = await sb.from('clients').select('name').eq('id', ticket.client_id).single();

  const { data: messages, error: msgErr } = await sb
    .from('ticket_messages')
    .select('id, author, body, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  if (msgErr) {
    console.error('[founder:tickets:detail] messages error:', msgErr.message);
    return res.status(500).json({ error: 'Could not load messages' });
  }

  // Mark as read for founder
  if (ticket.unread_founder) {
    await sb.from('support_tickets').update({ unread_founder: false }).eq('id', id);
  }

  return res.json({
    id: ticket.id,
    client_id: ticket.client_id,
    client_name: (clientRow as any)?.name || 'Unknown',
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    unread: ticket.unread_founder,
    messages: (messages || []).map((m) => ({
      id: m.id,
      author: m.author,
      body: m.body,
      created_at: m.created_at,
    })),
  });
});

export default router;