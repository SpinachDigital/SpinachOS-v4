/*
 * job-queue.ts — Phase 5 GOAL 1: Postgres-backed job queue (pg-boss pattern).
 *
 * Fire-and-forget paths (grow dispatch, workflow watcher) become queued jobs:
 * - retry with exponential backoff (30s * 2^attempt, capped)
 * - dead-letter queue (status='dead') — VISIBLE via /api/v1/jobs, not silent
 * - single worker loop (5s tick), at-most-once claim via status flip
 *
 * Pattern adopted (MIT, pg-boss); the lib itself not adopted — a 70-line
 * table+loop does the job without a new dependency (self-host weight).
 *
 * Schema: migration-phase5-hardening.sql (job_queue + laya_routing_decisions
 * + byok tables — one ordered Phase 5 migration set).
 */

import { supabase } from './ctx';

export interface Job {
  id: string;
  queue: string;
  payload: Record<string, any>;
  status: 'queued' | 'running' | 'done' | 'failed' | 'dead';
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

// Handlers per queue name. Register in index.ts.
const handlers = new Map<string, (payload: Record<string, any>) => Promise<void>>();

export function registerHandler(queue: string, fn: (payload: Record<string, any>) => Promise<void>) {
  handlers.set(queue, fn);
}

export async function enqueue(queue: string, payload: Record<string, any>, maxAttempts = 3): Promise<string | null> {
  const { data, error } = await supabase
    .from('job_queue')
    .insert({ queue, payload, max_attempts: maxAttempts, status: 'queued', attempts: 0, next_run_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) {
    // Enqueue failure is NOT silent — it goes to the logs and the caller sees null.
    console.error(`[queue] enqueue failed (${queue}):`, error.message);
    return null;
  }
  return data.id;
}

const BASE_BACKOFF_MS = 30_000;
const MAX_BACKOFF_MS = 15 * 60_000;

// One tick: claim due jobs, run their handlers, retry/backoff or dead-letter.
// Claim is at-most-once: status flip queued→running happens in the UPDATE's
// WHERE clause, so two workers can never run the same job.
async function tick(): Promise<{ ran: number; failed: number }> {
  // Claim batch: due, queued → running.
  const { data: due, error: claimErr } = await supabase
    .from('job_queue')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('status', 'queued')
    .lte('next_run_at', new Date().toISOString())
    .lt('attempts', 999) // guard
    .select('id, queue, payload, attempts, max_attempts')
    .limit(10);
  if (claimErr) {
    console.error('[queue] claim failed:', claimErr.message);
    return { ran: 0, failed: 0 };
  }
  let ran = 0, failed = 0;
  for (const job of due || []) {
    const handler = handlers.get(job.queue);
    if (!handler) {
      // No handler = configuration bug → straight to dead (no point retrying).
      await supabase.from('job_queue').update({
        status: 'dead', last_error: `no handler registered for queue '${job.queue}'`, updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      failed++;
      continue;
    }
    try {
      await handler(job.payload);
      await supabase.from('job_queue').update({ status: 'done', updated_at: new Date().toISOString() }).eq('id', job.id);
      ran++;
    } catch (e: any) {
      failed++;
      const attempts = (job.attempts || 0) + 1;
      const isDead = attempts >= (job.max_attempts || 3);
      const backoff = Math.min(BASE_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
      await supabase.from('job_queue').update({
        status: isDead ? 'dead' : 'queued',
        attempts,
        next_run_at: isDead ? new Date().toISOString() : new Date(Date.now() + backoff).toISOString(),
        last_error: String(e?.message || e).slice(0, 500),
        updated_at: new Date().toISOString(),
      }).eq('id', job.id);
      if (isDead) {
        // DLQ visibility: log + a feed event so THE INBOX surface sees it too.
        console.error(`[queue] job ${job.id} DEAD after ${attempts} attempts (${job.queue}):`, e?.message);
        try {
          const { emitFeed } = require('./ctx');
          emitFeed({ type: 'job_dead', message: `Job ${job.queue} died after ${attempts} attempts: ${String(e?.message || e).slice(0, 120)}`, job_id: job.id, at: new Date().toISOString() });
        } catch { /* feed emit must never break the queue */ }
      } else {
        console.warn(`[queue] job ${job.id} failed (attempt ${attempts}/${job.max_attempts}), retry in ${Math.round(backoff / 1000)}s:`, e?.message);
      }
    }
  }
  return { ran, failed };
}

// Worker stats for /health (GOAL 4): last tick time + counts.
let lastTickAt: string | null = null;
let lastTickResult: { ran: number; failed: number } | null = null;
let workerTimer: ReturnType<typeof setInterval> | null = null;

export function getQueueHealth() {
  return { running: !!workerTimer, last_tick_at: lastTickAt, last_tick: lastTickResult };
}

export function startQueueWorker(intervalMs = 5_000) {
  if (workerTimer) return; // idempotent start
  workerTimer = setInterval(() => {
    void tick().then((r) => {
      lastTickAt = new Date().toISOString();
      lastTickResult = r;
      // Only log when something happened (noise discipline).
      if (r.ran || r.failed) console.log(`[queue] tick: ${r.ran} ran, ${r.failed} failed/retried`);
    }).catch((e) => console.error('[queue] tick crashed:', e?.message));
  }, intervalMs);
  console.log(`[queue] worker started (${intervalMs}ms tick) — handlers: ${[...handlers.keys()].join(', ') || 'none yet'}`);
}
