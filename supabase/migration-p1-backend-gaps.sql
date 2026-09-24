-- P1 BACKEND GAPS — invoices table + RAG isolation fix (2026-09-25)
-- Run in Supabase SQL editor. Idempotent.

-- ============================================================
-- TASK 1 — invoices table (Client 360 parked section)
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    package_key TEXT,                      -- 'brand_identity' | 'digital_launch' | 'growth' | 'scale'
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sent', 'due', 'paid', 'overdue', 'cancelled')),
    due_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- RLS: API-only access via service_role (matches the rest of the schema)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role" ON invoices;
CREATE POLICY "Allow all for service_role" ON invoices
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- TASK 7 — NULL client_id isolation fix (leak footgun closed)
-- Client-scoped retrieval must see ONLY that client's chunks.
-- NULL-client (agency-global) chunks are now excluded from
-- client-scoped queries; they remain visible only to explicitly
-- global queries (p_client_id IS NULL).
-- Same predicate applied to BOTH hybrid RPCs so RRF fusion
-- never resurrects a leaked row from the other side.
-- ============================================================
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
      (p_client_id IS NOT NULL AND kc.client_id = p_client_id)
      OR (p_client_id IS NULL AND kc.client_id IS NULL)
    )
  ORDER BY (kc.embedding::halfvec(2048)) <=> (p_query_embedding::halfvec(2048))
  LIMIT p_limit;
$$;

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
      (p_client_id IS NOT NULL AND kc.client_id = p_client_id)
      OR (p_client_id IS NULL AND kc.client_id IS NULL)
    )
  ORDER BY rank DESC
  LIMIT p_limit;
$$;
