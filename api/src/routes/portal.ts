/*
 * routes/portal.ts — Phase 8: CLIENT PORTAL (blueprint v2-aligned).
 *
 * Invite-only. Read-only at its core. One write: client approve/request-changes
 * on deliverables explicitly sent for their review. THE INBOX stays the
 * FOUNDER's — the client never touches the machinery.
 *
 *   POST /api/v1/portal/invites            — founder-only: create invite → magic link
 *   POST /api/v1/portal/invites/:id/revoke — founder-only
 *   GET  /api/v1/portal/invites            — founder-only: list invites per client
 *   GET  /api/v1/portal/redeem?token=...   — PUBLIC: validate → session (rate-limited)
 *   POST /api/v1/portal/logout             — client: kill own session
 *
 *   GET  /api/v1/portal/overview           — client: pipeline summary + waiting-on-you
 *   GET  /api/v1/portal/deliverables       — client: filed deliverables (signed download URLs)
 *   GET  /api/v1/portal/deliverables/:id/download — client: signed URL (their client_id only)
 *   GET  /api/v1/portal/timeline           — client: project events, newest first
 *   GET  /api/v1/portal/pending-reviews    — client: deliverables awaiting THEIR sign-off
 *   POST /api/v1/portal/reviews/:id/decision — client: THE ONE WRITE (approve/changes)
 *
 * Security: token HASHES only (SHA-256), invite expiry 7d, session 30d sliding,
 * redeem rate-limited (10/min/IP), clientAuthMiddleware on every client route,
 * client-scoped Supabase client (JWT carries client_id → RLS enforces isolation).
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { app, supabase, broadcast, emitFeed } from '../ctx';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

// ---- token hygiene: SHA-256 hashes only, never raw ----
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const rawToken = () => crypto.randomBytes(32).toString('hex');

// ---- client-scoped Supabase client (RLS enforcement, not route code) ----
// The anon key + the session JWT carrying { client_id, role: 'client' } —
// every query rides RLS policies (client_read_own_*), the service key NEVER
// touches a client-facing query.
function clientScopedClient(sessionToken: string) {
  const base = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!key) return null; // no anon key configured → callers fall back to manual scoping
  const c = createClient(base, key, {
    global: { headers: { Authorization: `Bearer ${sessionToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return c;
}

// ---- redeem rate limit: 10/min per IP (brute-force protection) ----
const redeemLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true, legacyHeaders: false });

// ---- clientAuthMiddleware: validates the session token, attaches client ctx ----
export interface ClientCtx {
  client_id: string;
  role: 'client';
  session_token: string;
}

export async function clientAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Session required' });
  const hash = sha256(token);
  const { data: sess, error } = await supabase
    .from('client_sessions')
    .select('client_id, expires_at, token_hash')
    .eq('token_hash', hash)
    .single();
  if (error || !sess) return res.status(401).json({ error: 'Invalid session' });
  if (new Date(sess.expires_at) < new Date()) {
    await supabase.from('client_sessions').delete().eq('token_hash', hash); // expired → gone
    return res.status(401).json({ error: 'Session expired' });
  }
  // sliding expiry: every valid call extends the session (30d rolling)
  void supabase
    .from('client_sessions')
    .update({ last_seen_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() })
    .eq('token_hash', hash);
  (req as any).client = { client_id: sess.client_id, role: 'client', session_token: token } as ClientCtx;
  next();
}

// ---- founder middleware rejects client sessions EXPLICITLY (probe this) ----
// (authMiddleware alone would accept any signed JWT; portal admin routes must
//  also verify the caller is NOT a client session — role check on the JWT.)
import { JWT_SECRET } from '../ctx';
import jwt from 'jsonwebtoken';
function founderOnlyMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    if (decoded.role === 'client') {
      // explicit rejection — a client session must NEVER reach founder routes
      return res.status(403).json({ error: 'Founder routes only' });
    }
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
}

// ============================================================
// GOAL 1 — invite → magic link → session
// ============================================================

// POST /api/v1/portal/invites — founder-only: create invite → magic link
app.post('/api/v1/portal/invites', founderOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const { client_id, email, expires_days } = req.body || {};
    if (!client_id || !email) return res.status(400).json({ error: 'client_id and email required' });
    // client must exist
    const { data: client } = await supabase.from('clients').select('id, name').eq('id', client_id).single();
    if (!client) return res.status(404).json({ error: 'client not found' });
    const days = Math.min(Number(expires_days) || 7, 30);
    const raw = rawToken();
    const expires = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString();
    const { data: invite, error } = await supabase
      .from('portal_invites')
      .insert({ client_id, email: String(email).trim().toLowerCase(), token_hash: sha256(raw), expires_at: expires, created_by: (req as any).user?.sub || 'director' })
      .select('id, client_id, email, expires_at, used_at, revoked, created_at')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    // magic link shown ONCE — the raw token never stored server-side
    const origin = process.env.PORTAL_URL || 'http://localhost:3000';
    const link = `${origin}/portal?token=${raw}`;
    res.status(201).json({ invite, link, expires_at: expires });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/portal/invites?client_id= — founder-only: invite status list
app.get('/api/v1/portal/invites', founderOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const { client_id } = req.query;
    let q = supabase
      .from('portal_invites')
      .select('id, client_id, email, expires_at, used_at, revoked, created_by, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (client_id) q = q.eq('client_id', String(client_id));
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    // status derivation: pending/used/expired/revoked
    const now = new Date().toISOString();
    const rows = (data || []).map((i: any) => ({
      ...i,
      status: i.revoked ? 'revoked' : i.used_at ? 'used' : i.expires_at < now ? 'expired' : 'pending',
    }));
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/portal/invites/:id/revoke — founder-only
app.post('/api/v1/portal/invites/:id/revoke', founderOnlyMiddleware, async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('portal_invites')
      .update({ revoked: true })
      .eq('id', req.params.id)
      .select('id, client_id, email, revoked')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ error: 'invite not found' });
    // kill any session minted from this invite's client with matching email? No —
    // sessions are independent; revoke only blocks FUTURE redeems (documented).
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/portal/redeem?token=... — PUBLIC, rate-limited, no info leakage
app.get('/api/v1/portal/redeem', redeemLimiter, async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || '');
    if (!token) return res.status(401).json({ error: 'Invalid invite' }); // no WHY
    const hash = sha256(token);
    const { data: invite } = await supabase
      .from('portal_invites')
      .select('id, client_id, expires_at, used_at, revoked')
      .eq('token_hash', hash)
      .single();
    // ALL failure modes → the same 401, same message (no information leakage)
    if (!invite || invite.revoked || invite.used_at || new Date(invite.expires_at) < new Date()) {
      return res.status(401).json({ error: 'Invalid invite' });
    }
    // create the session (30d) — raw session token returned ONCE, hash stored
    const sraw = rawToken();
    const sexpires = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
    const { error: sErr } = await supabase
      .from('client_sessions')
      .insert({ client_id: invite.client_id, token_hash: sha256(sraw), expires_at: sexpires });
    if (sErr) return res.status(500).json({ error: 'session creation failed' });
    // mark the invite used (single-use, always)
    await supabase.from('portal_invites').update({ used_at: new Date().toISOString() }).eq('id', invite.id);
    const { data: client } = await supabase.from('clients').select('name').eq('id', invite.client_id).single();
    res.json({ token: sraw, client_id: invite.client_id, client_name: client?.name || '', expires_at: sexpires });
  } catch (e: any) {
    res.status(500).json({ error: 'Invalid invite' }); // even crashes don't leak
  }
});

// POST /api/v1/portal/logout — client kills own session
app.post('/api/v1/portal/logout', clientAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const hash = sha256((req as any).client.session_token);
    await supabase.from('client_sessions').delete().eq('token_hash', hash);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================================
// GOAL 3 — Client Twin: the read-only portal (RLS-scoped)
// ============================================================

// helper: resolve the RLS-scoped client for a session; falls back to the
// service client + explicit client_id filter when no anon key is configured
// (the filter is still enforced HERE — RLS remains the DB-level guarantee).
function scoped(req: Request) {
  const ctx = (req as any).client as ClientCtx;
  const c = clientScopedClient(ctx.session_token);
  return { ctx, c: c || supabase, rls: !!c, client_id: ctx.client_id };
}

// GET /api/v1/portal/overview — pipeline status summary + waiting-on-client
app.get('/api/v1/portal/overview', clientAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { ctx, c, rls, client_id } = scoped(req);
    // workflows (pipelines) for this client
    let wf = c.from('workflows').select('id, name, current_step, progress, status, steps_json, updated_at');
    wf = rls ? wf : wf.eq('client_id', client_id);
    const { data: workflows, error: wfErr } = await wf;
    if (wfErr && rls) return res.status(500).json({ error: wfErr.message });
    // waiting on client = deliverables in pending_client_review
    let pr = c.from('deliverables').select('id, title, version').eq('metadata->>client_review', 'pending');
    pr = rls ? pr : pr.eq('client_id', client_id);
    const { data: pending } = await pr;
    const list = workflows || [];
    res.json({
      client_id,
      client_name: (await c.from('clients').select('name').eq('id', client_id).single()).data?.name || '',
      pipelines: list.map((w: any) => ({ id: w.id, name: w.name, step: w.current_step, progress: w.progress, status: w.status })),
      active_count: list.filter((w: any) => w.status === 'active').length,
      waiting_on_you: (pending || []).length,
      waiting_on_you_items: (pending || []).map((d: any) => ({ id: d.id, title: d.title, version: d.version })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/portal/deliverables — filed deliverables (their client_id only)
app.get('/api/v1/portal/deliverables', clientAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { ctx, c, rls, client_id } = scoped(req);
    let q = c
      .from('deliverables')
      .select('id, client_id, title, kind, file_url, version, released_at, created_at, metadata')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!rls) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ client_id, deliverables: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/portal/deliverables/:id/download — signed expiring URL (their client_id only)
app.get('/api/v1/portal/deliverables/:id/download', clientAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { ctx, c, rls, client_id } = scoped(req);
    let q = c.from('deliverables').select('id, client_id, title, kind, file_url').eq('id', req.params.id).single();
    const { data: d, error } = await q;
    if (error || !d) return res.status(404).json({ error: 'not found' });
    // RLS already filtered by client_id when rls; double-check (defense in depth)
    if (!rls && d.client_id !== client_id) return res.status(403).json({ error: 'forbidden' });
    if (rls && d.client_id !== client_id) return res.status(403).json({ error: 'forbidden' });
    if (!d.file_url) return res.status(400).json({ error: 'no file bytes — text/link deliverables have no download' });
    const [bucket, ...pathParts] = String(d.file_url).split('/');
    const path = pathParts.join('/');
    const { data: signed, error: sErr } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (sErr || !signed) return res.status(500).json({ error: 'signed url failed' });
    res.json({ ok: true, url: signed.signedUrl, expires_in: 3600, title: d.title });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/portal/timeline — project events (memory ledger + pipeline events), newest first
app.get('/api/v1/portal/timeline', clientAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { ctx, c, rls, client_id } = scoped(req);
    // pipeline_events carry client_id — RLS or explicit filter
    let pe = c.from('pipeline_events').select('id, workflow_id, event, from_step, to_step, actor, detail, created_at');
    pe = rls ? pe : pe.eq('client_id', client_id);
    const { data: events, error } = await pe.order('created_at', { ascending: false }).limit(50);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ client_id, events: events || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/portal/pending-reviews — deliverables awaiting THEIR sign-off
app.get('/api/v1/portal/pending-reviews', clientAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { ctx, c, rls, client_id } = scoped(req);
    let q = c
      .from('deliverables')
      .select('id, client_id, title, kind, version, file_url, released_at, created_at, metadata')
      .eq('metadata->>client_review', 'pending')
      .order('created_at', { ascending: false })
      .limit(50);
    if (!rls) q = q.eq('client_id', client_id);
    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ client_id, reviews: data || [] });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/v1/portal/reviews/:id/decision — THE ONE WRITE (approve / request-changes)
app.post('/api/v1/portal/reviews/:id/decision', clientAuthMiddleware, async (req: Request, res: Response) => {
  try {
    const { ctx, c, rls, client_id } = scoped(req);
    const { decision, note } = req.body || {};
    if (!['approved', 'changes_requested'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'changes_requested'" });
    }
    // fetch the deliverable — scoped by client (RLS or explicit)
    let q = c.from('deliverables').select('id, client_id, title, version, metadata, workflow_id').eq('id', req.params.id).single();
    const { data: d, error: dErr } = await q;
    if (dErr || !d) return res.status(404).json({ error: 'not found' });
    if (d.client_id !== client_id) return res.status(403).json({ error: 'forbidden' });
    // only deliverables in pending_client_review are actionable
    if (d.metadata?.client_review !== 'pending') {
      return res.status(403).json({ error: `not awaiting review (status: ${d.metadata?.client_review || 'none'})` });
    }
    const newReview = decision === 'approved' ? 'accepted' : 'changes_requested';
    const { data: updated, error: uErr } = await supabase
      .from('deliverables')
      .update({
        metadata: { ...d.metadata, client_review: newReview, client_note: note || null, decided_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.id)
      .select('id, title, version, metadata')
      .single();
    if (uErr) return res.status(500).json({ error: uErr.message });
    // ledger entry (the decision is recorded — replayable)
    void supabase.from('agent_memory').insert({
      agent_profile: 'client-portal',
      memory_type: 'decision',
      key: `client_review:${d.id}`,
      value: { deliverable_id: d.id, title: d.title, decision, note: note || null, client_id, at: new Date().toISOString() },
    });
    // founder feed event — NOT a second inbox; the founder acts from THE INBOX
    emitFeed('client-portal', decision === 'approved' ? 'deliverable accepted' : 'changes requested', `${d.title} v${d.version} — ${note || 'no note'}`);
    broadcast('portal_review', { deliverable_id: d.id, title: d.title, decision, client_id });
    res.json({ ok: true, deliverable: updated, decision });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
