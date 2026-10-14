-- N3 §1: typed agent event stream — idempotent, dashboard-SQL-editor safe.
-- One row per typed agent event. The frontend renders these as a structured
-- stream (no more text soup). Shape contract:
--   { type, at, actor, summary, ref? }
-- type ∈ tool_call | progress | approval_requested | approval_decided
--      | error | done

CREATE TABLE IF NOT EXISTS agent_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN (
    'tool_call', 'progress', 'approval_requested',
    'approval_decided', 'error', 'done'
  )),
  actor text NOT NULL,
  summary text NOT NULL,
  ref jsonb,
  task_id uuid,
  thread_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_events_task_idx
  ON agent_events (task_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_events_thread_idx
  ON agent_events (thread_id, created_at DESC);

ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;

-- The command-center reads with the service role (bypasses RLS); this policy
-- keeps direct anon reads off without breaking the app.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_events' AND policyname = 'agent_events_service_write'
  ) THEN
    CREATE POLICY agent_events_service_write ON agent_events
      FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
