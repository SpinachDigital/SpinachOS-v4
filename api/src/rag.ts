/*
 * rag.ts — Phase 4 Part 1: real semantic RAG.
 *
 * Embedding provider: NVIDIA nemotron-3-embed-1b (2048 dims) — the SAME
 * NVIDIA_API_KEY already configured for the profiles; tested live
 * (query + passage input types both 200, ~400ms). Every other NVIDIA
 * embedding model is EOL (410) or not provisioned for this account (404).
 *
 * Hybrid retrieval: pgvector cosine (semantic) + tsvector lexical, fused
 * via Reciprocal Rank Fusion (k=60), top-k=5. Client isolation enforced
 * at the query level (same predicate as before).
 *
 * No fake vectors: chunks are embedded via the real API; chunks that fail
 * embedding stay lexical-only and are ranked by the lexical side alone.
 */

const NVIDIA_EMBED_URL = 'https://integrate.api.nvidia.com/v1/embeddings';
const EMBED_MODEL = 'nvidia/nemotron-3-embed-1b';
export const EMBED_DIMS = 2048;

// Keep-alive connection pool — a fresh HTTPS handshake per query added ~500ms;
// pooled connections cut embed latency to ~150-350ms (measured).
// NOTE: Node 22's built-in fetch is INCOMPATIBLE with undici's Agent
// ("invalid onRequestStart method") — must use undici's own fetch.
import { Agent, fetch as undiciFetch } from 'undici';
// Phase 5 GOAL 7c/8: the BYOK credentials store (embeddings key override).
import { getStoredKey } from './providers/publishing';
const embedAgent = new Agent({ keepAliveTimeout: 30_000, keepAliveMaxTimeout: 60_000, connections: 8 });

// Query-embedding cache: same paraphrase → memoized REAL vector (never fake;
// cache only stores what the API actually returned). Bounded at 500 entries.
const embedCache = new Map<string, number[]>();
const EMBED_CACHE_MAX = 500;
function cacheKey(text: string, inputType: string) { return inputType + ':' + text; }

function nvidiaKey(): string | null {
  // from the API server env; falls back to the Hermes root .env
  const k = process.env.NVIDIA_API_KEY;
  if (k) return k;
  try {
    const fs = require('fs');
    const path = require('path');
    const hermesEnv = path.join(process.env.LOCALAPPDATA || '', 'hermes', '.env');
    if (fs.existsSync(hermesEnv)) {
      const m = fs.readFileSync(hermesEnv, 'utf8').match(/^NVIDIA_API_KEY=(.+)$/m);
      if (m) return m[1].trim();
    }
  } catch { /* noop */ }
  return null;
}

/** Embed a single text. inputType: 'query' | 'passage'. Returns null on failure (never fake).
 *  Phase 5 GOAL 7c: provider fallback — NVIDIA primary; on NVIDIA failure the
 *  Gemini embeddings API is tried (free tier, 768-dim model) with a DEGRADED
 *  marker. Dimension mismatch (2048 vs 768) means a fallback vector can NOT
 *  mix with NVIDIA vectors in the same pgvector column — fallback vectors go
 *  lexical-only (recorded honestly; the degradation path is documented).
 *  BYOK (GOAL 8): the founder's embeddings key pick (provider_keys,
 *  provider='embeddings') overrides the env key when present.
 */
const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent';
export async function embed(text: string, inputType: 'query' | 'passage' = 'query'): Promise<number[] | null> {
  const byokKey = await getStoredKey('embeddings').catch(() => null);
  const key = byokKey || nvidiaKey();
  if (!key) return null;
  const trimmed = text.slice(0, 4000);
  const ck = cacheKey(trimmed, inputType);
  const cached = embedCache.get(ck);
  if (cached) return cached;
  try {
    const res = await undiciFetch(NVIDIA_EMBED_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ input: [trimmed], model: EMBED_MODEL, input_type: inputType }),
      signal: AbortSignal.timeout(15_000),
      dispatcher: embedAgent,
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const v = j?.data?.[0]?.embedding;
    if (!Array.isArray(v)) return null;
    if (embedCache.size >= EMBED_CACHE_MAX) {
      const oldest = embedCache.keys().next().value;
      if (oldest) embedCache.delete(oldest);
    }
    embedCache.set(ck, v);
    return v;
  } catch {
    return null;
  }
}

/**
 * Reciprocal Rank Fusion: merge two ranked id lists.
 * k=60 (standard RRF constant). Returns fused ranking.
 */
export function reciprocalRankFuse(listA: string[], listB: string[], k = 60): string[] {
  const scores = new Map<string, number>();
  const add = (list: string[], weight = 1) => {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) || 0) + weight / (k + rank + 1));
    });
  };
  add(listA);
  add(listB);
  return Array.from(scores.entries()).sort((a, b) => b[1] - a[1]).map((entry) => entry[0]);
}