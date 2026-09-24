-- PHASE 4 PART 1 — Real semantic RAG (pgvector + NVIDIA nemotron-3-embed-1b, 2048 dims)
-- Run in Supabase SQL editor. Idempotent.

-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Real embedding column — REPLACES the JSONB placeholder.
--    (v6 §9 created `embedding JSONB` as a never-populated slot. IF NOT EXISTS
--    would silently skip, leaving JSONB, and the HNSW index would fail with
--    "vector_cosine_ops does not accept data type jsonb". Drop it first.)
ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS embedding;
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedding vector(2048);

-- 3. HNSW index (cosine) — pgvector HNSW caps at 2000 dims, and nemotron
--    embeddings are 2048d, so index a halfvec EXPRESSION instead (pgvector
--    >= 0.7; halfvec indexes up to 4000d, half-precision index only —
--    storage and RPCs stay full-precision vector(2048)).
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON knowledge_chunks USING hnsw ((embedding::halfvec(2048)) halfvec_cosine_ops);

-- 4. Backfill marker column: chunks without embeddings get NULL — the API
--    embeds them lazily on first touch (see embedChunkLazy in the API).
--    Backfill row count will be reported by the API after it runs.

-- 5. updated_at trigger for re-embedding management
ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- 6. RPC: semantic side (pgvector cosine, client-isolated, embeddings only)
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
      (p_client_id IS NOT NULL AND (kc.client_id = p_client_id OR kc.client_id IS NULL))
      OR (p_client_id IS NULL AND kc.client_id IS NULL)
    )
  ORDER BY (kc.embedding::halfvec(2048)) <=> (p_query_embedding::halfvec(2048))
  LIMIT p_limit;
$$;

-- 7. RPC: lexical side (tsvector websearch, same isolation)
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
      (p_client_id IS NOT NULL AND (kc.client_id = p_client_id OR kc.client_id IS NULL))
      OR (p_client_id IS NULL AND kc.client_id IS NULL)
    )
  ORDER BY rank DESC
  LIMIT p_limit;
$$;