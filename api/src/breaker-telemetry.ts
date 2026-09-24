/*
 * breaker-telemetry.ts — shared circuit breaker + fallback log (P1 Tasks 4+5).
 *
 * ONE state for the whole API process: bridge.ts gateway calls and index.ts
 * runAgentTask both count into the same per-provider breaker, so telemetry at
 * GET /api/v1/models/breakers reflects every outbound LLM call.
 *
 * Minimal breaker: 3 consecutive failures → OPEN for 15 min → HALF-OPEN probe.
 */
export interface BreakerState {
  provider: string;
  state: 'closed' | 'open' | 'half-open';
  consecutive_failures: number;
  total_failures: number;
  last_failure_at: string | null;
  opened_at: string | null;
}

const BREAKER_THRESHOLD = 3;
const BREAKER_OPEN_MS = 15 * 60 * 1000; // 15 min

const breakers = new Map<string, BreakerState & { _openedAtMs?: number }>();

function breakerFor(provider: string) {
  if (!breakers.has(provider)) {
    breakers.set(provider, { provider, state: 'closed', consecutive_failures: 0, total_failures: 0, last_failure_at: null, opened_at: null });
  }
  return breakers.get(provider)!;
}

export function breakerAllows(b: BreakerState & { _openedAtMs?: number }): boolean {
  if (b.state === 'closed') return true;
  if (b.state === 'open') {
    if (b._openedAtMs && Date.now() - b._openedAtMs >= BREAKER_OPEN_MS) {
      b.state = 'half-open'; // let one probe through
      return true;
    }
    return false;
  }
  return true; // half-open: probe allowed
}

export function recordFailure(b: BreakerState & { _openedAtMs?: number }) {
  b.consecutive_failures += 1;
  b.total_failures += 1;
  b.last_failure_at = new Date().toISOString();
  if (b.state === 'half-open' || (b.state === 'closed' && b.consecutive_failures >= BREAKER_THRESHOLD)) {
    b.state = 'open';
    b.opened_at = new Date().toISOString();
    b._openedAtMs = Date.now();
    console.warn(`[breaker] OPEN for provider=${b.provider} after ${b.consecutive_failures} consecutive failures`);
  }
}

export function recordSuccess(b: BreakerState & { _openedAtMs?: number }) {
  b.consecutive_failures = 0;
  b._openedAtMs = undefined;
  if (b.state !== 'closed') console.log(`[breaker] CLOSED again for provider=${b.provider}`);
  b.state = 'closed';
  b.opened_at = null;
}

export function getBreakerStates(): BreakerState[] {
  return Array.from(breakers.values()).map(({ provider, state, consecutive_failures, total_failures, last_failure_at, opened_at }) =>
    ({ provider, state, consecutive_failures, total_failures, last_failure_at, opened_at }));
}

// Convenience for the single-provider (omniroute) case used by runAgentTask.
export function gatewayBreakerAllows(): boolean { return breakerAllows(breakerFor('omniroute')); }
export function recordGatewayFailure() { recordFailure(breakerFor('omniroute')); }
export function recordGatewaySuccess() { recordSuccess(breakerFor('omniroute')); }
export { breakerFor };

// ---- fallback event log (P1 Task 5) ----
export interface FallbackEvent {
  from: string;
  to: string;
  reason: string;
  timestamp: string;
}
const fallbackLog: FallbackEvent[] = [];
const FALLBACK_LOG_MAX = 200;
export function recordFallback(from: string, to: string, reason: string) {
  fallbackLog.unshift({ from, to, reason, timestamp: new Date().toISOString() });
  if (fallbackLog.length > FALLBACK_LOG_MAX) fallbackLog.length = FALLBACK_LOG_MAX;
  console.warn(`[fallback] ${from} → ${to} (${reason})`);
}
export function getFallbackLog(): FallbackEvent[] { return fallbackLog.slice(); }
