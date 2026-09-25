import cron from 'node-cron';
/*
 * cron-engine.ts — WAKE_BRAINS + fireBrain + startRetainerCron (Phase 3 split, index.ts L618–678).
 */
import jwt from 'jsonwebtoken';
import { supabase, emitFeed, JWT_SECRET } from './ctx';
import { executeAgentTask } from './engines/agent-execution';
import { RETAINER_CRON_RUNNING, setRetainerCronRunning } from './retainer-cron-state';

export const WAKE_BRAINS: Array<{ id: string; schedule: string; agent: string; task: string }> = [
  { id: 'standup-daily-0930', schedule: '30 9 * * 1-5', agent: 'orchestrator',
    task: 'Daily standup: list yesterday\'s completed runs, today\'s active pipelines, and any blockers. One tight report.' },
  { id: 'cto-weekly-review', schedule: '0 10 * * 1', agent: 'cto',
    task: 'Weekly tech review: audit system health, flag anything fragile that would break at 100 clients, propose one boring fix.' },
  { id: 'ceo-monthly-strategy', schedule: '0 11 1 * *', agent: 'ceo',
    task: 'Monthly strategy: review package mix and pipeline throughput; recommend where to grow and where to protect. Max 200 words.' },
];
export const WAKE_CRON_STATES: Record<string, boolean> = {};

export const fireBrain = async (b: typeof WAKE_BRAINS[number]) => {
  try {
    const token = jwt.sign({ sub: `cron-${b.id}`, role: 'director' }, JWT_SECRET, { expiresIn: '10m' });
    const r = await fetch('http://localhost:4000/api/v1/agents/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ agent: b.agent, task: b.task, source: `cron:${b.id}` }),
    });
    const j = await r.json();
    console.log(`[${b.id}] fired → ${r.status} task=${j.task_id || j.error || '?'}`);
  } catch (e: any) {
    console.error(`[${b.id}] failed:`, e?.message);
  }
};

export const startRetainerCron = () => {
  if (RETAINER_CRON_RUNNING) return;
  try {
    cron.schedule('0 9 * * *', async () => {
      try {
        const token = jwt.sign({ sub: 'retainer-cron', role: 'director' }, JWT_SECRET, { expiresIn: '10m' });
        const r = await fetch('http://localhost:4000/api/v1/retainer/run-due', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        const j = await r.json();
        if (j.started > 0) emitFeed('orchestrator', 'RETAINER_CRON', { started: j.started, results: j.results?.length });
        console.log(`[retainer-cron] ${new Date().toISOString()} started=${j.started || 0}`);
      } catch (e: any) {
        console.error('[retainer-cron] failed:', e?.message);
      }
    });
    setRetainerCronRunning(true);
    console.log('[retainer-cron] armed: daily 09:00 IST → POST /api/v1/retainer/run-due');
  } catch (e: any) {
    console.error('[retainer-cron] arm failed:', e?.message);
  }
  // A4 idle-brain schedules — arm each, track state for /cron/jobs reporting
  for (const b of WAKE_BRAINS) {
    try {
      cron.schedule(b.schedule, () => void fireBrain(b));
      WAKE_CRON_STATES[b.id] = true;
      console.log(`[${b.id}] armed: "${b.schedule}" → ${b.agent}`);
    } catch (e: any) {
      WAKE_CRON_STATES[b.id] = false;
      console.error(`[${b.id}] arm failed:`, e?.message);
    }
  }
};
startRetainerCron();

