/*
 * retainer-cron-state.ts — retainer cron state flag (Phase 3 split, index.ts L613).
 * Mutable state shared by the retainer cron + the cron endpoints.
 */
export let RETAINER_CRON_RUNNING = false;
export function setRetainerCronRunning(v: boolean) { RETAINER_CRON_RUNNING = v; }
