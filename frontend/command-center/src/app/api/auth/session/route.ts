// Server-side session mint (P0-compatible auth flow).
//
// After the P0 lockdown, POST /api/v1/auth/token requires an existing director
// JWT (or the one-time BOOTSTRAP_ADMIN_TOKEN). The browser has neither — so
// direct browser mints 401 and the whole /api/v1 surface dies in the UI
// (observed: Settings → Models & Brains "Couldn't load profiles: API 401").
//
// Fix: this Next server route holds the bootstrap secret SERVER-SIDE (env,
// gitignored) and mints on the browser's behalf. The secret never enters the
// JS bundle; the browser receives only the short-lived (24h) director JWT,
// same trust boundary as the original design.
import { NextResponse } from 'next/server';

let cached: { token: string; expires_at_ms: number } | null = null;

export async function GET() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

  // serve from cache while >5 min of validity remains
  if (cached && Date.now() < cached.expires_at_ms - 5 * 60 * 1000) {
    return NextResponse.json({ token: cached.token, token_type: 'Bearer', expires_at: new Date(cached.expires_at_ms).toISOString() });
  }

  const boot = process.env.API_BOOTSTRAP_TOKEN;
  if (!boot) {
    return NextResponse.json({ error: 'API_BOOTSTRAP_TOKEN not configured on the frontend server (set it in frontend/command-center/.env.local)' }, { status: 503 });
  }

  try {
    const r = await fetch(`${apiBase}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${boot}` },
      body: JSON.stringify({ sub: 'director', role: 'director' }),
    });
    if (!r.ok) {
      return NextResponse.json({ error: `mint failed: ${r.status}` }, { status: 502 });
    }
    const data = await r.json();
    const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : Date.now() + 24 * 60 * 60 * 1000;
    cached = { token: data.token, expires_at_ms: expiresAtMs };
    return NextResponse.json({ token: data.token, token_type: data.token_type || 'Bearer', expires_at: data.expires_at });
  } catch {
    return NextResponse.json({ error: 'API unreachable' }, { status: 502 });
  }
}
