'use client';

// Shared auth token helper: mints a real signed JWT from the API and caches it in localStorage.
// The API's authMiddleware verifies signature + expiry (jsonwebtoken), so the old hardcoded
// 'eyJhbG...CVqI' fallback (malformed payload) always 401'd — this helper replaces it everywhere.

// Env-driven so the dashboard works against any API host (local dev, LAN, Oracle VM).
// Falls back to localhost for zero-config local development.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const CACHE_KEY = 'spinach_token_cache';
// Refresh 5 minutes before actual expiry so in-flight requests never race the expiry
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface TokenCache {
  token: string;
  expires_at: number; // epoch ms
}

let inflight: Promise<string> | null = null;

async function mintToken(): Promise<TokenCache> {
  // P0-compatible flow: the API's mint endpoint now requires an existing
  // director JWT / bootstrap token, which the browser must never hold. The
  // Next server route (/api/auth/session) carries the bootstrap secret
  // server-side and mints on our behalf — the browser only ever receives
  // the short-lived director JWT.
  const res = await fetch('/api/auth/session', { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Token mint failed: ${res.status}`);
  }
  const data = await res.json();
  // Server returns expires_at ISO; fall back to 24h if missing
  const expiresAtMs = data.expires_at
    ? new Date(data.expires_at).getTime()
    : Date.now() + 24 * 60 * 60 * 1000;
  const cache: TokenCache = { token: data.token, expires_at: expiresAtMs };
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage unavailable — memory-only cache still works for this session
  }
  return cache;
}

/** Get a valid, unexpired JWT — cached in localStorage, auto-minted on miss or near-expiry. */
export async function getAuthToken(): Promise<string> {
  // Reuse an in-flight mint if one is running (parallel requests share it)
  if (inflight) return inflight;

  let cached: TokenCache | null = null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) cached = JSON.parse(raw) as TokenCache;
  } catch {
    cached = null;
  }

  if (cached && cached.token && Date.now() < cached.expires_at - REFRESH_MARGIN_MS) {
    return cached.token;
  }

  inflight = mintToken()
    .then((c) => c.token)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Force-refresh the token (e.g. after a 401 TOKEN_EXPIRED response mid-session). */
export async function refreshAuthToken(): Promise<string> {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
  return getAuthToken();
}

/** Standard authorized fetch: attaches the Bearer token, retries once on token expiry. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(init.headers || {});
  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${token}`);

  let res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
    ...init,
    headers,
  });

  // Any 401 (expired OR stale/invalid — e.g. signed with a rotated-away
  // JWT_SECRET sitting in localStorage) → drop the cache, re-mint via the
  // server-side session route, retry exactly once.
  if (res.status === 401) {
    try {
      const body = await res.clone().json().catch(() => null);
      if (!body || body?.code === 'TOKEN_EXPIRED' || body?.code === 'TOKEN_INVALID') {
        const fresh = await refreshAuthToken();
        headers.set('Authorization', `Bearer ${fresh}`);
        res = await fetch(path.startsWith('http') ? path : `${API_BASE}${path}`, {
          ...init,
          headers,
        });
      }
    } catch {
      // re-mint itself failed — return the original 401 as-is
    }
  }
  return res;
}

// Build a WebSocket URL from NEXT_PUBLIC_API_BASE (http→ws conversion).
// Single source of truth for WS endpoints — no hardcoded hosts anywhere.
export function buildWsUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000').replace(/^http/, 'ws');
  return `${base}${path}`;
}
