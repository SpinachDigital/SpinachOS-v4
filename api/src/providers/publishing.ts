/*
 * providers/publishing.ts — Phase 5 GOAL 9: the publishing connector registry.
 *
 * Open architecture (founder decision 2026-10-04): every provider implements
 * the Publisher interface — publish(), schedule(), status(), connect(),
 * disconnect(), getCapabilities(). Credentials are DB-backed (provider_keys,
 * founder connects/disconnects from the UI); grow.ts calls
 * getActivePublisher() — it NEVER imports a provider directly. Adding a
 * future tool = one new provider module registered here, zero core changes.
 *
 * Buffer-vs-Publora evaluation (owed from Sprint 13, 3 lines):
 * 1. Buffer: mature scheduling + per-platform quirks handled, but SaaS
 *    dependency + per-channel pricing for an agency posting 10+/day.
 * 2. Publora: cheaper, API-first, founder pre-decided; schedule() + threads
 *    fit the GROW loop; risk = younger platform (mitigated by the registry —
 *    swapping providers is config, not code).
 * 3. Verdict: Publora primary behind the registry; Buffer stays a
 *    pluggable option if Publora stalls (one new module, zero core changes).
 */

export interface PublishRequest {
  platform: string;
  text: string;
  mediaUrls: string[];
  scheduledAt: string;
}

export interface PublishResult {
  mode: 'live' | 'dry-run';
  postId?: string;
  scheduledId?: string;
  error?: string;
}

export interface PublisherCapabilities {
  platforms: string[];
  scheduling: boolean;
  threads: boolean;
  carousels: boolean;
  media: boolean;
}

export interface Publisher {
  name: string;
  getCapabilities(): PublisherCapabilities;
  isConnected(): Promise<boolean>;
  connect(credentials: { token: string; baseUrl?: string }): Promise<boolean>;
  disconnect(): Promise<boolean>;
  publish(req: PublishRequest): Promise<PublishResult>;
  schedule(req: PublishRequest): Promise<PublishResult>;
  status(postId: string): Promise<{ state: string; error?: string }>;
}

// ---------------------------------------------------------------------
// Publora provider — the primary. Credentials DB-backed (provider_keys
// row provider='publora'); env vars remain a bootstrap fallback.
// ---------------------------------------------------------------------
const publora: Publisher = {
  name: 'publora',

  getCapabilities(): PublisherCapabilities {
    return { platforms: ['x', 'linkedin', 'instagram', 'threads'], scheduling: true, threads: true, carousels: true, media: true };
  },

  async isConnected(): Promise<boolean> {
    const key = await getStoredKey('publora');
    return !!(key || process.env.PUBLORA_API_TOKEN);
  },

  async connect(credentials): Promise<boolean> {
    return await storeKey('publora', credentials.token, 'Publora (connected by founder)');
  },

  async disconnect(): Promise<boolean> {
    return await deleteKey('publora');
  },

  async publish(req): Promise<PublishResult> {
    const key = (await getStoredKey('publora')) || process.env.PUBLORA_API_TOKEN || '';
    if (!key) return { mode: 'dry-run', postId: `dryrun-${Date.now()}` };
    try {
      const base = process.env.PUBLORA_BASE_URL || 'https://api.publora.com/v1';
      const res = await fetch(`${base}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ platform: req.platform, content: req.text, media: req.mediaUrls }),
      });
      if (!res.ok) return { mode: 'live', error: `Publora ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const data = await res.json();
      return { mode: 'live', postId: data?.id || data?.post_id || `publora-${Date.now()}` };
    } catch (e: any) {
      return { mode: 'live', error: `Publora failed: ${e?.message?.slice(0, 200)}` };
    }
  },

  async schedule(req): Promise<PublishResult> {
    const key = (await getStoredKey('publora')) || process.env.PUBLORA_API_TOKEN || '';
    if (!key) return { mode: 'dry-run', scheduledId: `dryrun-${Date.now()}` };
    try {
      const base = process.env.PUBLORA_BASE_URL || 'https://api.publora.com/v1';
      const res = await fetch(`${base}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ platform: req.platform, content: req.text, media: req.mediaUrls, schedule_at: req.scheduledAt }),
      });
      if (!res.ok) return { mode: 'live', error: `Publora ${res.status}: ${(await res.text()).slice(0, 200)}` };
      const data = await res.json();
      return { mode: 'live', scheduledId: data?.id || data?.post_id || `publora-${Date.now()}` };
    } catch (e: any) {
      return { mode: 'live', error: `Publora failed: ${e?.message?.slice(0, 200)}` };
    }
  },

  async status(postId): Promise<{ state: string; error?: string }> {
    const key = (await getStoredKey('publora')) || process.env.PUBLORA_API_TOKEN || '';
    if (!key) return { state: 'unknown', error: 'not connected' };
    try {
      const base = process.env.PUBLORA_BASE_URL || 'https://api.publora.com/v1';
      const res = await fetch(`${base}/posts/${postId}`, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) return { state: 'unknown', error: `Publora ${res.status}` };
      const data = await res.json();
      return { state: data?.status || 'unknown' };
    } catch (e: any) {
      return { state: 'unknown', error: e?.message?.slice(0, 120) };
    }
  },
};

// ---------------------------------------------------------------------
// Credentials store (DB-backed, provider_keys). Server-side ONLY — values
// never leave the server except masked (getStoredKey returns the real value
// for API calls; the API routes mask it in responses).
// ---------------------------------------------------------------------
import { supabase } from '../ctx';

export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '…' + key.slice(-4);
}

export async function getStoredKey(provider: string): Promise<string | null> {
  const { data } = await supabase.from('provider_keys').select('key_ciphertext, is_active').eq('provider', provider).single();
  if (!data || !data.is_active) return null;
  return data.key_ciphertext;
}

export async function storeKey(provider: string, value: string, label?: string): Promise<boolean> {
  const { error } = await supabase.from('provider_keys').upsert({
    provider, key_ciphertext: value, label: label || provider, is_active: true, updated_at: new Date().toISOString(),
  });
  if (error) { console.error(`[providers] storeKey(${provider}) failed:`, error.message); return false; }
  return true;
}

export async function deleteKey(provider: string): Promise<boolean> {
  const { error } = await supabase.from('provider_keys').delete().eq('provider', provider);
  if (error) { console.error(`[providers] deleteKey(${provider}) failed:`, error.message); return false; }
  return true;
}

// ---------------------------------------------------------------------
// The registry — grow.ts talks to THIS, never to a provider directly.
// ---------------------------------------------------------------------
const registry = new Map<string, Publisher>();
registry.set('publora', publora);

// MOCK provider — Phase 10 GOAL 3: proves pluggability (the interface works
// with any registered provider; founder connects real ones via the registry).
// Activated only when a provider_keys row provider='mock' is active.
const mock: Publisher = {
  name: 'mock',
  getCapabilities(): PublisherCapabilities {
    return { platforms: ['x', 'linkedin', 'instagram', 'blog'], scheduling: true, threads: false, carousels: false, media: false };
  },
  async isConnected(): Promise<boolean> {
    return !!(await getStoredKey('mock'));
  },
  async connect(credentials): Promise<boolean> {
    return await storeKey('mock', credentials.token, 'MOCK provider (E2E/testing)');
  },
  async disconnect(): Promise<boolean> {
    return await deleteKey('mock');
  },
  async publish(req): Promise<PublishResult> {
    if (!(await getStoredKey('mock'))) return { mode: 'dry-run', postId: `dryrun-${Date.now()}` };
    return { mode: 'live', postId: `mock-${Date.now()}` };
  },
  async schedule(req): Promise<PublishResult> {
    if (!(await getStoredKey('mock'))) return { mode: 'dry-run', scheduledId: `dryrun-${Date.now()}` };
    return { mode: 'live', scheduledId: `mock-sched-${Date.now()}` };
  },
  async status(postId) {
    return { state: postId.startsWith('mock-') ? 'published' : 'unknown' };
  },
};
registry.set('mock', mock);

export function listPublishers(): { name: string; connected: boolean; capabilities: PublisherCapabilities }[] {
  // Synchronous list of names; connected/capabilities filled by the async route.
  return [...registry.keys()].map((name) => ({ name, connected: false, capabilities: registry.get(name)!.getCapabilities() }));
}

export function getPublisher(name: string): Publisher | null {
  return registry.get(name) || null;
}

// Active provider: provider_keys.is_active rows decide; fallback order —
// publora (primary). Nothing connected → dry-run everywhere (never stalls).
export async function getActivePublisher(): Promise<Publisher | null> {
  for (const name of registry.keys()) {
    const p = registry.get(name)!;
    if (await p.isConnected()) return p;
  }
  return null;
}
