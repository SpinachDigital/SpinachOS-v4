-- Spinach OS v6 — D2 Retainer loop migration
-- Run in Supabase SQL Editor (idempotent — safe to re-run)

CREATE TABLE IF NOT EXISTS retainer_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    package_key TEXT NOT NULL,
    month_number INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'cancelled')),
    next_run_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    workflow_id UUID,
    last_workflow_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (client_id, month_number)
);
CREATE INDEX IF NOT EXISTS idx_retainer_due ON retainer_runs(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_retainer_client ON retainer_runs(client_id, month_number DESC);
ALTER TABLE retainer_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role" ON retainer_runs;
CREATE POLICY "Allow all for service_role" ON retainer_runs FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE retainer_runs;
EXCEPTION WHEN OTHERS THEN END;
$$;