/*
 * routes/overview.ts — Phase 12 GOAL 4: the company on one screen.
 *
 * GET /api/v1/overview (founder-only):
 *   { today: { approvals_pending, tickets_open, leads_new, content_scheduled },
 *     pipelines: [{ id, name, client_name, stage, progress }],
 *     inbox_top: [{ id, title, type, triage_score }] (top 5 by triage),
 *     win_week: { new_leads, qualified, onboarded },
 *     grow_week: { planned, published } }
 *
 * Every number traces to a real row. All counts are DB `count: exact` reads —
 * bounded, indexed, and honest. p95 < 500ms (latency law).
 */

import { app, supabase, JWT_SECRET } from '../ctx';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

function founderOnly(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    if (decoded.role === 'client') {
      return res.status(403).json({ error: 'Founder routes only' });
    }
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
}

app.get('/api/v1/overview', founderOnly, async (_req: Request, res: Response) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

    const [approvals, tickets, leads, scheduled, pipelinesRaw, inboxRaw, wlNew, wlQualified, wlOnboarded, gPlanned, gPublished] = await Promise.all([
      // ---- today: the 4 numbers ----
      supabase.from('approvals').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('support_tickets').select('id', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('status', 'scheduled'),
      // ---- active pipelines (top 6 by recency) ----
      supabase.from('workflows')
        .select('id, name, client_id, current_step, progress, status, updated_at')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(6),
      // ---- inbox top by triage (50 pending, scored client-side of the SQL) ----
      supabase.from('approvals')
        .select('id, title, type, metadata')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50),
      // ---- WIN this week ----
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new').gte('updated_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'qualified').gte('updated_at', weekAgo),
      supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'onboarded').gte('updated_at', weekAgo),
      // ---- GROW this week (planned = scheduled|approved, published = published) ----
      supabase.from('content_items').select('id', { count: 'exact', head: true }).in('status', ['scheduled', 'approved']).gte('updated_at', weekAgo),
      supabase.from('content_items').select('id', { count: 'exact', head: true }).eq('status', 'published').gte('updated_at', weekAgo),
    ]);

    // client names (bounded, one query)
    const clientIds = Array.from(new Set((pipelinesRaw?.data || []).map((p: any) => p.client_id).filter(Boolean)));
    const { data: clients } = clientIds.length
      ? await supabase.from('clients').select('id, name').in('id', clientIds)
      : { data: [] };
    const nameById = new Map((clients || []).map((c: any) => [c.id, c.name]));

    // ---- inbox top 5 by triage (the same triage the approvals page runs) ----
    const inboxTop = (inboxRaw?.data || [])
      .map((a: any) => ({
        id: a.id, title: a.title, type: a.type,
        triage_score: (a.metadata?.triage_score ?? (a.type === 'gate' ? 90 : a.type === 'outreach' || a.type === 'lead_qualified' ? 70 : 50)),
      }))
      .sort((x: any, y: any) => y.triage_score - x.triage_score)
      .slice(0, 5);

    res.json({
      today: {
        approvals_pending: approvals.count ?? 0,
        tickets_open: tickets.count ?? 0,
        leads_new: leads.count ?? 0,
        content_scheduled: scheduled.count ?? 0,
      },
      pipelines: (pipelinesRaw?.data || []).map((p: any) => ({
        id: p.id, name: p.name,
        client_name: nameById.get(p.client_id) || '—',
        stage: p.current_step || '—',
        progress: p.progress ?? 0,
      })),
      inbox_top: inboxTop,
      win_week: {
        new_leads: wlNew.count ?? 0,
        qualified: wlQualified.count ?? 0,
        onboarded: wlOnboarded.count ?? 0,
      },
      grow_week: {
        planned: gPlanned.count ?? 0,
        published: gPublished.count ?? 0,
      },
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
