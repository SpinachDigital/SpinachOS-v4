/*
 * logging.ts — Phase 5 GOAL 4: JSON structured logs with levels.
 *
 * One logger, whole-system discipline: every log line is JSON
 * { ts, level, subsystem, msg, ...extra } — greppable, parseable, honest.
 * Levels: debug | info | warn | error. LOG_LEVEL env gates debug/info.
 *
 * The old console.log scattered lines stay where they are (behavior-parity),
 * but new Phase 5 code logs through this.
 */

type Level = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const configured = (process.env.LOG_LEVEL as Level) || 'info';

function log(level: Level, subsystem: string, msg: string, extra?: Record<string, any>) {
  if (LEVEL_RANK[level] < LEVEL_RANK[configured]) return;
  const line = JSON.stringify({ ts: new Date().toISOString(), level, subsystem, msg, ...(extra || {}) });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (subsystem: string, msg: string, extra?: Record<string, any>) => log('debug', subsystem, msg, extra),
  info: (subsystem: string, msg: string, extra?: Record<string, any>) => log('info', subsystem, msg, extra),
  warn: (subsystem: string, msg: string, extra?: Record<string, any>) => log('warn', subsystem, msg, extra),
  error: (subsystem: string, msg: string, extra?: Record<string, any>) => log('error', subsystem, msg, extra),
};

// Express request log middleware — one JSON line per API call.
import type { Request, Response, NextFunction } from 'express';
export function requestLog(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  res.on('finish', () => {
    // Skip noise: health checks spam would bury real signals.
    if (req.path === '/health' || req.path === '/api/system/health') return;
    log('info', 'http', `${req.method} ${req.path}`, {
      status: res.statusCode, ms: Date.now() - start,
    });
  });
  next();
}
