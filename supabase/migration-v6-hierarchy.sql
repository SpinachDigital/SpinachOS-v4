-- Spinach OS v6 — Hierarchy + Packages migration
-- Run in Supabase SQL Editor (idempotent — safe to re-run)

-- ============================================================
-- SECTION 0 — Fix agent_states_profile_check FIRST.
-- The old constraint whitelists only legacy profiles and rejects the
-- v6 HODs (designer, engineer, seo_specialist, ads_manager) — this is
-- the exact error: "new row for relation agent_states violates check
-- agent_states_profile_check". Drop and replace with a permissive guard.
-- ============================================================
ALTER TABLE agent_states DROP CONSTRAINT IF EXISTS agent_states_profile_check;
-- Permissive by design: emitAgentState() upserts arbitrary agents at runtime
-- (hired specialists, director, from_agent in messages…). The app owns profile
-- naming; the DB only rejects empty/garbage strings.
ALTER TABLE agent_states ADD CONSTRAINT agent_states_profile_check
  CHECK (profile ~ '^[a-z][a-z0-9_]{1,39}$');

-- 1. agent_state_log — append-only history (fixes last-write-wins thrash at scale)
CREATE TABLE IF NOT EXISTS agent_state_log (
    id BIGSERIAL PRIMARY KEY,
    agent TEXT NOT NULL,
    state TEXT NOT NULL,
    activity TEXT,
    task_id UUID,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_state_log_agent ON agent_state_log(agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_state_log_task ON agent_state_log(task_id);
ALTER TABLE agent_state_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role" ON agent_state_log;
CREATE POLICY "Allow all for service_role" ON agent_state_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. agent_registry — tier, reports_to, profile_name, bench
ALTER TABLE agent_states ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'hod'
  CHECK (tier IN ('leadership', 'hod', 'executive'));
ALTER TABLE agent_states ADD COLUMN IF NOT EXISTS reports_to TEXT;
ALTER TABLE agent_states ADD COLUMN IF NOT EXISTS profile_name TEXT;
ALTER TABLE agent_states ADD COLUMN IF NOT EXISTS bench JSONB DEFAULT '[]'::jsonb;
ALTER TABLE agent_states ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE agent_states ADD COLUMN IF NOT EXISTS is_dormant BOOLEAN DEFAULT FALSE;

-- 3. packages — 4 presets
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    price_inr INTEGER NOT NULL,
    billing TEXT NOT NULL CHECK (billing IN ('one_time', 'monthly')),
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. clients — package linkage + brand DNA
ALTER TABLE clients ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES packages(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS has_logo BOOLEAN DEFAULT FALSE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS brand_dna JSONB DEFAULT '{}'::jsonb;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS intake_notes TEXT;

-- 5. Seed the 4 package presets
INSERT INTO packages (key, name, price_inr, billing, steps, description) VALUES
('brand_identity', 'Brand Identity', 14999, 'one_time',
 '[{"name":"intake","agent":"orchestrator"},{"name":"classify","agent":"laya"},{"name":"dna_extract","agent":"designer"},{"name":"logo_design","agent":"designer"},{"name":"guidelines","agent":"designer"},{"name":"hod_qa","agent":"designer"},{"name":"approve","agent":"director"},{"name":"deliver","agent":"ops"}]'::jsonb,
 'Logo + guidelines + brand DNA. Code-drawn SVG only.'),
('digital_launch', 'Digital Launch', 24999, 'one_time',
 '[{"name":"intake","agent":"orchestrator"},{"name":"strategy","agent":"ceo"},{"name":"website","agent":"engineer"},{"name":"content","agent":"social"},{"name":"seo_setup","agent":"seo_specialist"},{"name":"gmb","agent":"seo_specialist"},{"name":"hod_qa","agent":"orchestrator"},{"name":"approve","agent":"director"},{"name":"deliver","agent":"ops"}]'::jsonb,
 'Website + content + SEO/GMB setup + launch.'),
('growth', 'Growth', 19999, 'monthly',
 '[{"name":"content_plan","agent":"social"},{"name":"content_creation","agent":"social"},{"name":"design_assets","agent":"designer"},{"name":"seo_check","agent":"seo_specialist"},{"name":"monthly_report","agent":"research"},{"name":"approve","agent":"director"},{"name":"deliver","agent":"ops"}]'::jsonb,
 'Monthly retainer: content + design + SEO + report.'),
('scale', 'Scale', 39999, 'monthly',
 '[{"name":"content_plan","agent":"social"},{"name":"content_creation","agent":"social"},{"name":"design_assets","agent":"designer"},{"name":"seo_check","agent":"seo_specialist"},{"name":"ads_manage","agent":"ads_manager"},{"name":"monthly_report","agent":"research"},{"name":"approve","agent":"director"},{"name":"deliver","agent":"ops"}]'::jsonb,
 'Growth + paid media (auto-activates ads_manager).')
ON CONFLICT (key) DO NOTHING;

-- 6. Seed the hierarchy (leadership + HODs; ads_manager dormant)
INSERT INTO agent_states (profile, state, activity, tier, reports_to, display_name, is_dormant) VALUES
('ceo', 'idle', 'Strategy desk', 'leadership', NULL, 'CEO', FALSE),
('cto', 'idle', 'Systems desk', 'leadership', NULL, 'CTO', FALSE),
('orchestrator', 'idle', 'Chief of staff', 'leadership', NULL, 'Orchestrator', FALSE),
('designer', 'idle', 'Brand guardian', 'hod', 'ceo', 'Design HOD', FALSE),
('engineer', 'idle', 'The shipper', 'hod', 'cto', 'Engineering HOD', FALSE),
('social', 'idle', 'Founder''s voice', 'hod', 'ceo', 'Marketing HOD', FALSE),
('seo_specialist', 'idle', 'Patient compounder', 'hod', 'cto', 'SEO HOD', FALSE),
('research', 'idle', 'Evidence desk', 'hod', 'ceo', 'Research HOD', FALSE),
('sales', 'idle', 'Relationship holder', 'hod', 'ceo', 'Sales HOD', FALSE),
('ads_manager', 'idle', 'Numbers brain (dormant)', 'hod', 'ceo', 'Paid Media HOD', TRUE)
ON CONFLICT (profile) DO NOTHING;

-- 8. Allow 'churned' status (hibernation path needs it)
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;
ALTER TABLE clients ADD CONSTRAINT clients_status_check
  CHECK (status IN ('active', 'inactive', 'pending', 'churned'));

-- 9. RAG (Part E4) — knowledge chunks, lexical-first (tsvector), pgvector-ready.
--    design: swap `embedding` to vector(1536) + add HNSW index when an embedding
--    provider lands on OmniRoute; the API writes both paths identically.
CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,   -- NULL = agency-wide
    scope TEXT NOT NULL DEFAULT 'agency' CHECK (scope IN ('agency', 'client')),
    kind TEXT NOT NULL DEFAULT 'document',                     -- intake | dna | asset | report | conversation
    title TEXT,
    content TEXT NOT NULL,
    source TEXT,                                               -- file path / URL / agent that produced it
    metadata JSONB DEFAULT '{}',
    -- lexical search (live now)
    tsv TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', coalesce(title,'') || ' ' || content)) STORED,
    -- pgvector slot (unused until provider exists; keep NULL)
    embedding JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chunks_client ON knowledge_chunks(client_id);
CREATE INDEX IF NOT EXISTS idx_chunks_tsv ON knowledge_chunks USING GIN (tsv);
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role" ON knowledge_chunks;
CREATE POLICY "Allow all for service_role" ON knowledge_chunks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Auto-ingest triggers: new client intake → agency memory; approved assets → client DNA
CREATE OR REPLACE FUNCTION ingest_client_intake() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO knowledge_chunks (client_id, scope, kind, title, content, source)
    VALUES (
        NEW.id, 'client', 'intake',
        'Intake — ' || NEW.name,
        coalesce(NEW.name,'') || E'\n' || coalesce(NEW.business_type,'') || E'\n' ||
        coalesce(NEW.location,'') || E'\n' || coalesce(NEW.goal,'') || E'\n' ||
        coalesce(NEW.intake_notes, '') || E'\n' ||
        CASE WHEN NEW.has_logo THEN 'Client has a logo — extract DNA from it.' ELSE 'No logo — brand DNA to be created (code-drawn SVG).' END,
        'clients trigger'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ingest_client_intake ON clients;
CREATE TRIGGER trg_ingest_client_intake
    AFTER INSERT ON clients
    FOR EACH ROW EXECUTE FUNCTION ingest_client_intake();

-- 10. Realtime for new tables
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE agent_state_log;
EXCEPTION WHEN OTHERS THEN END;
$$;
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE packages;
EXCEPTION WHEN OTHERS THEN END;
$$;