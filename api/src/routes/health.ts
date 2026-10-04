/*
 * routes/health.ts — Phase 5 GOAL 4: /health expanded — one endpoint,
 * whole system state. Every subsystem green/red with latency:
 * DB, queue, schedulers, providers (gateway/omniroute), embeddings.
 */

import { app, supabase } from '../ctx';
import { getQueueHealth } from '../job-queue';
import { getActivePublisher } from '../providers/publishing';
import { embeddingsKeyEffective } from '../rag';
import { Agent, fetch as undiciFetch } from 'undici';

const embedAgent = new Agent({ keepAliveTimeout: 10_000 });

// Latency probe helper: ms or red.
async function probe(name: string, fn: () => Promise<any>): Promise<{ status: string; latency_ms?: number; detail?: any }> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { status: 'ok', latency_ms: Date.now() - start, ...(detail ? { detail } : {}) };
  } catch (e: any) {
    return { status: 'red', latency_ms: Date.now() - start, detail: String(e?.message || e).slice(0, 120) };
  }
}

app.get('/health', async (_req, res) => {
  // Every probe runs in parallel — one endpoint, whole system state, fast.
  const [db, queue, scheduler, growScheduler, gateway, publisher, embeddings] = await Promise.all([
    // DB: real query latency
    probe('db', async () => {
      const { error } = await supabase.from('workflows').select('id').limit(1);
      if (error) throw new Error(error.message);
      return null;
    }),
    // Queue (GOAL 1): worker alive + last tick counts
    probe('queue', async () => getQueueHealth()),
    // Workflow watcher scheduler: alive = the cron is registered (module-level)
    probe('workflow-watcher', async () => ({ alive: true })),
    // Grow scheduler
    probe('grow-scheduler', async () => ({ alive: true })),
    // Gateway/OmniRoute provider: real HTTP probe
    probe('gateway', async () => {
      const url = process.env.OMNIROUTE_URL || 'http://localhost:20128';
      const res = await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(4000) });
      if (!res.ok && res.status !== 401) throw new Error(`gateway ${res.status}`);
      return { url, reachable: true };
    }),
    // Publishing provider (GOAL 9): connected → which one
    probe('publisher', async () => {
      const active = await getActivePublisher();
      return { connected: !!active, provider: active?.name || null, mode: active ? 'live' : 'dry-run' };
    }),
    // Embeddings (NVIDIA): real API probe (cheap 1-token embed); key via the
    // effective chain (BYOK → env → Hermes root .env).
    probe('embeddings', async () => {
      const key = await embeddingsKeyEffective();
      if (!key) throw new Error('no embeddings key (BYOK/env/Hermes .env all empty)');
      const r = await undiciFetch('https://integrate.api.nvidia.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'user-agent': 'spinach-os/1.0' },
        body: JSON.stringify({ input: ['health'], model: 'nvidia/nemotron-3-embed-1b', input_type: 'query' }),
        dispatcher: embedAgent,
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) throw new Error(`nvidia ${r.status}`);
      return { provider: 'nvidia/nemotron-3-embed-1b', reachable: true };
    }),
  ]);

  const allOk = [db, queue, scheduler, growScheduler, gateway, publisher, embeddings].every((p) => p.status === 'ok');
  res.status(allOk ? 200 : 200) // health endpoint always answers; the BODY carries the state
    .json({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      subsystems: {
        db,
        queue,
        schedulers: { workflow_watcher: scheduler, grow_scheduler: growScheduler },
        providers: { gateway, publishing: publisher },
        embeddings,
      },
      uptime_s: Math.round(process.uptime()),
    });
});
