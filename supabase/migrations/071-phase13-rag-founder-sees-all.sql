-- ============================================================
-- 071 — PHASE 13 GOAL 3: RAG founder-sees-all + client isolation stays.
--
-- Contract (hermes-phase-13-prompt.md SECURITY #1):
--   "Client_id filter must be enforced server-side — a FOUNDER sees ALL,
--    nobody else sees anything."
--
-- The Phase 4 RPCs treated a NULL client_id as "agency-wide only" — meaning
-- the founder's unfiltered search could never see any client-scoped chunk
-- (every intake was invisible: 50 chunks, 0 results). This migration keeps
-- the API surface identical and fixes the isolation predicate:
--   p_client_id IS NULL → ALL chunks (founder mode)
--   p_client_id given   → that client's chunks + agency-wide only
-- The HTTP layer stays founder-only (routes/knowledge.ts founderOnly) —
-- a client session never reaches these RPCs with its own id; the filter
-- exists for the founder's client-focused search.
-- ============================================================

-- 1. Lexical side (tsvector websearch)
CREATE OR REPLACE FUNCTION hybrid_chunks_lexical(
  p_query TEXT,
  p_client_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50
) RETURNS TABLE (id UUID, rank FLOAT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT kc.id, ts_rank(kc.tsv, websearch_to_tsquery('english', p_query)) AS rank
  FROM knowledge_chunks kc
  WHERE kc.tsv @@ websearch_to_tsquery('english', p_query)
    AND (
      p_client_id IS NULL
      OR (kc.client_id = p_client_id OR kc.client_id IS NULL)
    )
  ORDER BY rank DESC
  LIMIT p_limit;
$$;

-- 2. Semantic side (pgvector cosine)
CREATE OR REPLACE FUNCTION hybrid_chunks_semantic(
  p_query_embedding vector(2048),
  p_client_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50
) RETURNS TABLE (id UUID, similarity FLOAT)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT kc.id, 1 - (kc.embedding <=> p_query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.embedding IS NOT NULL
    AND (
      p_client_id IS NULL
      OR (kc.client_id = p_client_id OR kc.client_id IS NULL)
    )
  ORDER BY (kc.embedding::halfvec(2048)) <=> (p_query_embedding::halfvec(2048))
  LIMIT p_limit;
$$;
