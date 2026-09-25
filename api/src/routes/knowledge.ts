/*
 * routes/knowledge.ts — Phase 3 monolith split (from index.ts L1170–1339).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
import { reciprocalRankFuse, embed } from '../rag';

// -- imports auto-added by fix-imports (Phase 3)
import { app, authMiddleware, emitFeed, supabase } from '../ctx';
import { hybridRetrieve } from '../knowledge-helper';
app.post('/api/v1/knowledge/ingest', authMiddleware, async (req, res) => {
  const { client_id = null, scope, kind = 'document', title, content, source, metadata = {} } = req.body;
  if (!content) return res.status(400).json({ error: 'content required' });
  const finalScope = client_id ? 'client' : (scope || 'agency');

  // Phase 4: embed at ingest — real vectors, never fake. Failure = lexical-only chunk (honest).
  const embedText = `${title ? title + '\n' : ''}${content}`;
  const vec = await embed(embedText, 'passage');

  const insertPayload: any = { client_id, scope: finalScope, kind, title: title || null, content, source: source || null, metadata };
  if (vec) { insertPayload.embedding = vec; insertPayload.embedded_at = new Date().toISOString(); }

  const { data, error } = await supabase.from('knowledge_chunks')
    .insert(insertPayload)
    .select('id, title, scope, kind, client_id, embedded_at')
    .single();
  if (error) return res.status(500).json({ error: `ingest failed: ${error.message} (run migrations first)` });
  emitFeed('system', 'RAG_INGEST', { chunk: data.title || data.id, scope: data.scope, embedded: !!vec });
  res.status(201).json({ ...data, embedded: !!vec });
});

// POST /api/v1/knowledge/backfill-embeddings — embed all chunks missing vectors (Phase 4 backfill).
// Idempotent; safe to re-run. Reports counts.
app.post('/api/v1/knowledge/backfill-embeddings', authMiddleware, async (_req, res) => {
  const { data: pending, error } = await supabase
    .from('knowledge_chunks')
    .select('id, title, content')
    .is('embedded_at', null)
    .limit(500);
  if (error) return res.status(500).json({ error: `backfill query failed: ${error.message} (run supabase/migration-phase4-rag.sql first)` });
  if (!pending || pending.length === 0) return res.json({ embedded: 0, total_pending: 0, message: 'all chunks already embedded' });

  let ok = 0, fail = 0;
  for (const c of pending) {
    const vec = await embed(`${c.title ? c.title + '\n' : ''}${c.content}`, 'passage');
    if (vec) {
      const { error: upErr } = await supabase.from('knowledge_chunks')
        .update({ embedding: vec, embedded_at: new Date().toISOString() })
        .eq('id', c.id);
      if (upErr) fail++; else ok++;
    } else fail++;
  }
  emitFeed('system', 'RAG_BACKFILL', { embedded: ok, failed: fail });
  res.json({ embedded: ok, failed: fail, total_pending_before: pending.length });
});

// GET /api/v1/knowledge/query?q=...&client_id=...&limit=5 — HYBRID semantic+lexical retrieval (Phase 4)
// pgvector cosine (nemotron-3-embed-1b, 2048d) + tsvector, fused via Reciprocal Rank Fusion.
// Client isolation unchanged: client scope sees own + agency-wide; agency sees agency only.
app.get('/api/v1/knowledge/query', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const clientId = (req.query.client_id || '').toString() || null;
  const limit = Math.min(parseInt((req.query.limit || '5').toString(), 10) || 5, 20);
  if (!q) return res.status(400).json({ error: 'q required' });
  const t0 = Date.now();

  const isolation = clientId
    ? `client_id.eq.${clientId},client_id.is.null`
    : 'client_id.is.null';

  // ---- SEMANTIC + LEXICAL in parallel (Phase 4 perf fix) ----
  const [qvec, lexRes] = await Promise.all([
    embed(q, 'query'),
    supabase.rpc('hybrid_chunks_lexical', { p_query: q, p_client_id: clientId, p_limit: 50 }),
  ]);
  let semanticIds: string[] = [];
  if (qvec) {
    const { data: sem, error: semErr } = await supabase.rpc('hybrid_chunks_semantic', {
      p_query_embedding: qvec,
      p_client_id: clientId,
      p_limit: 50,
    });
    if (!semErr && Array.isArray(sem)) semanticIds = sem.map((r: any) => r.id);
  }
  let lexicalIds: string[] = [];
  if (!lexRes.error && Array.isArray(lexRes.data)) lexicalIds = lexRes.data.map((r: any) => r.id);

  // ---- FUSE (RRF) ----
  const fusedIds = reciprocalRankFuse(semanticIds, lexicalIds).slice(0, limit);
  if (fusedIds.length === 0) return res.json({ query: q, client_id: clientId, engine: 'hybrid', chunks: [], total: 0, ms: Date.now() - t0 });

  // fetch the fused rows
  const { data: rows, error } = await supabase
    .from('knowledge_chunks')
    .select('id, client_id, scope, kind, title, content, source, created_at')
    .in('id', fusedIds);
  if (error) return res.status(500).json({ error: `query failed: ${error.message}` });

  // order by fusion rank
  const byId = new Map((rows || []).map((r: any) => [r.id, r]));
  const chunks = fusedIds.map(id => byId.get(id)).filter(Boolean) as any[];
  const semanticSet = new Set(semanticIds);
  const lexicalSet = new Set(lexicalIds);

  res.json({
    query: q,
    client_id: clientId,
    engine: qvec ? 'hybrid' : 'lexical-fallback',
    chunks: chunks.map(c => ({ ...c, matched_by: semanticSet.has(c.id) && lexicalSet.has(c.id) ? 'both' : semanticSet.has(c.id) ? 'semantic' : 'lexical' })),
    total: chunks.length,
    ms: Date.now() - t0,
  });
});

// GET /api/v1/knowledge/context/:client_id — the D5 brief builder: task + client DNA + top-5 chunks.
// Phase 4: retrieval is now HYBRID (semantic + lexical, RRF) when a task/query is given
// (q param); without q it returns the freshest 5 chunks (DNA-first ordering).
app.get('/api/v1/knowledge/context/:client_id', authMiddleware, async (req, res) => {
  const clientId = req.params.client_id;
  const q = (req.query.q || '').toString().trim();
  const { data: client } = await supabase.from('clients').select('id, name, business_type, goal, metadata').eq('id', clientId).maybeSingle();
  if (!client) return res.status(404).json({ error: 'client not found' });

  let chunks: any[] = [];
  if (q) {
    // hybrid path — same engine as /knowledge/query, client-isolated
    const hybrid = await hybridRetrieve(q, clientId, 5);
    chunks = hybrid;
  } else {
    const { data: fresh, error } = await supabase
      .from('knowledge_chunks')
      .select('id, kind, title, content, created_at')
      .or(`client_id.eq.${clientId},client_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) return res.status(500).json({ error: `context failed: ${error.message}` });
    chunks = fresh || [];
  }

  const brief = {
    client: { id: client.id, name: client.name, industry: client.business_type, goal: client.goal },
    package: (client.metadata as any)?.package_key || null,
    brand_branch: (client.metadata as any)?.has_logo ? 'dna_from_logo' : 'code_drawn_svg',
    knowledge_chunks: chunks,
    retrieval: q ? 'hybrid (semantic+lexical RRF)' : 'recent-5 (DNA-first)',
    token_budget: 'top-5 chunks, ~5-8k tokens',
  };
  res.json(brief);
});

/**
 * hybridRetrieve — the ONE retrieval primitive (Phase 4). Semantic (pgvector
 * cosine via RPC) + lexical (tsvector websearch) fused with RRF, client-isolated.
 * Used by /knowledge/query, /knowledge/context, buildStepPrompt, startRetainerRun.
 */

