import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';
import { createServer } from 'http';
/*
 * ctx.ts — shared context for all route modules (Phase 3 monolith split).
 *
 * Holds everything the routes need from the old monolith's top section:
 * the Express app + middleware, supabase client, JWT config + middleware,
 * WS clients + emit helpers, sanitizeText, zod schemas. Route modules
 * import { x } from '../ctx' — ONE instance per process (Node module
 * cache), identical behavior.
 */
import express, { Request, Response, NextFunction } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

// ---- SECURITY (P0 Fix 3): no hardcoded fallback — crash on missing secret ----
if (!process.env.JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET is not set. Refusing to start (set it in api/.env — never commit).');
  process.exit(1);
}

// The ONE Express app (routes mount onto it via bare app.get/post calls).
export const app = express();
export const httpServer = createServer(app);
export const wss = new WebSocketServer({ noServer: true });

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(rateLimit({ windowMs: 60000, max: 200 }));

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const JWT_SECRET = process.env.JWT_SECRET;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface JwtPayload {
  sub: string;
  role: string;
  iat?: number;
  exp?: number;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    (req as any).user = decoded;
    next();
  } catch (e: any) {
    if (e?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    // Stale tokens (e.g. signed with a rotated-away JWT_SECRET) must be
    // distinguishable from "no token at all" so clients know to re-mint.
    return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
}

// ---- WebSocket emit helpers (one client set per process) ----
export const wsClients = new Set<WebSocket>();
export let wssRef: WebSocketServer | null = null;
export function setWss(wss: WebSocketServer) { wssRef = wss; }

export function broadcast(event: string, data: any) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
  // Mirror feed events to dashboard-adapter subscribers as activity.append items —
  // the spinach-os.html adapter subscribes on the same /ws socket and filters by type.
  if (event === 'feed') {
    const item = {
      id: 'a' + Date.now(),
      icon: 'check',
      tone: '',
      title: '<b>' + (data.profile || '') + ' — ' + (data.action || '') + '</b>',
      sub: typeof data.details === 'string' ? data.details : '',
      time: 'now',
    };
    const dashMsg = JSON.stringify({ type: 'activity.append', item });
    wsClients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(dashMsg);
    });
  }
}

export function emitFeed(profile: string, action: string, details?: any) {
  broadcast('feed', { profile, action, details, timestamp: new Date().toISOString() });
}

export function emitAgentState(agent: string, state: string, activity?: string) {
  broadcast('agent_state', { agent, state, activity, timestamp: new Date().toISOString() });
  // Persist to agent_states table (fire-and-forget) — keeps DB state fresh so restarts
  // and /api/v1/agent-states readers see reality, not stale rows.
  // Schema CHECK allows only: idle, thinking, working, speaking, blocked — map others.
  const persistState = state === 'paused' ? 'idle' : state;
  void supabase
    .from('agent_states')
    .upsert({ profile: agent, state: persistState, activity: activity || null, updated_at: new Date().toISOString() })
    .then(({ error }) => { if (error) console.error('agent_states persist failed:', error.message); });
}

export function emitTaskUpdate(task: any) {
  broadcast('task_update', task);
}

export function emitApproval(approval: any) {
  broadcast('approval', approval);
}

export function emitWorkflow(workflow: any) {
  broadcast('workflow', workflow);
}

export function emitTaskLifecycle(taskId: string, agent: string, status: 'running' | 'done' | 'blocked', activity: string, details?: any) {
  broadcast('task_lifecycle', { task_id: taskId, agent, status, activity, details, timestamp: new Date().toISOString() });
  emitTaskUpdate({ id: taskId, agent, status, activity });
}

// ---- sanitize (XSS/injection) ----
export const HTML_TAG_RE = /<[^>]*>/g;
export const DANGEROUS_PROTO_RE = /(?:javascript|data|vbscript):/gi;
export const EVENT_HANDLER_RE = /\bon\w+\s*=/gi;

export function sanitizeText(input: unknown, maxLen = 4000): string {
  let s = String(input ?? '');
  s = s.replace(HTML_TAG_RE, '');
  s = s.replace(DANGEROUS_PROTO_RE, '');
  s = s.replace(EVENT_HANDLER_RE, '');
  return s.slice(0, maxLen);
}

// ---- zod schemas (shared by routes) ----
export const ChatSchema = z.object({
  profile: z.enum(['ceo', 'cto', 'orchestrator', 'research', 'social', 'sales']),
  message: z.string().min(1),
  sessionId: z.string().uuid().optional(),
});
export const AgentSearchSchema = z.object({ query: z.string().min(1) });
export const AgentLoadSchema = z.object({ slug: z.string().min(1), task: z.string().min(1) });
export const ApprovalActionSchema = z.object({ id: z.string().uuid() });
export const HireAgentSchema = z.object({
  department: z.enum(['ceo', 'cto', 'orchestrator', 'research', 'social', 'hr', 'engineering', 'design', 'sales', 'marketing', 'content', 'ops']),
  role: z.string().min(1),
  specialization: z.string().optional(),
  skills: z.array(z.string()).optional(),
  agent_config: z.object({ model: z.string().optional() }).optional(),
});
export const AgentMessageSchema = z.object({ from_agent: z.string().min(1), to_agent: z.string().min(1), type: z.string().min(1), message: z.string().min(1), payload: z.record(z.any()).optional(), requires_response: z.boolean().optional(), });
export const BulkAgentActionSchema = z.object({ action: z.enum(["pause", "resume", "restart", "start", "stop", "status"]), profiles: z.array(z.string()).optional(), agents: z.array(z.string()).optional(), department: z.string().optional(), });
