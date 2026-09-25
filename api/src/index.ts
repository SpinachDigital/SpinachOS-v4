/*
 * index.ts — Spinach OS API bootstrap (Phase 3 monolith split).
 *
 * The old 4,463-line monolith is now:
 *   src/ctx.ts                — app + middleware + supabase + JWT + WS emit + sanitize + schemas
 *   src/routes/*.ts           — one file per domain (22 files; mounted below)
 *   src/engines/              — agent-execution, pipeline-run/-qa, bridge, rag, breaker-telemetry
 *   src/cron-engine.ts        — WAKE_BRAINS + retainer cron
 *   src/*-helpers.ts          — command-intent, command-thread, warroom, laya-client, dashboard
 *
 * This file is THIN BOOTSTRAP only: import ctx (which creates app/middleware),
 * mount routes, WS upgrade routing, error handler, listen. No behavior changes.
 */
import dotenv from 'dotenv';
dotenv.config();

import { app, httpServer, wss, wsClients, setWss } from './ctx';
import { WebSocket } from 'ws';
import { Request, Response, NextFunction } from 'express';

// ---- mount all route domains (order preserved from the monolith) ----
import './routes/auth';        // token minting (P0-secured)
import './routes/models';
import './routes/agents';
import './routes/cron';
import './routes/kanban';
import './routes/approvals';
import './routes/clients';
import './routes/knowledge';
import './routes/workflows';
import './routes/hr';
import './routes/standup';
import './routes/pipeline';
import './routes/retainer';
import './routes/command';
import './routes/laya';
import './routes/calendar';
import './routes/comms';
import './routes/scrapers';
import './routes/telegram';
import './routes/marketing';
import './routes/dashboard';

// ---- cron engine (WAKE_BRAINS + retainer cron) ----
import { startRetainerCron } from './cron-engine';
startRetainerCron();

// ---- WS wiring ----
setWss(wss);

// Static dashboard — spinach-os.html command center served by the API itself
import path from 'path';
import express from 'express';
app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws: WebSocket) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
  ws.on('error', () => wsClients.delete(ws));
});

// ---- START ----
// Manual upgrade routing: both /ws and /ws/activity land on the same wss instance
// (the dashboard adapter connects to /ws/activity and filters events by type).
httpServer.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url || '', `http://${request.headers.host || 'localhost'}`);
  if (pathname === '/ws' || pathname === '/ws/activity') {
    wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
  } else {
    socket.destroy();
  }
});

const PORT = process.env.PORT || 4000;

// ---- error handler (must be last) ----
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

httpServer.listen(PORT, () => {
  console.log(`Spinach OS API running on http://localhost:${PORT}`);
  console.log(`WebSocket on ws://localhost:${PORT}/ws and ws://localhost:${PORT}/ws/activity`);
});
