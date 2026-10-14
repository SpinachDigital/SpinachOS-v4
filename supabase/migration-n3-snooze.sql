-- N3 §4: snooze persistence — idempotent, dashboard-SQL-editor safe.
-- Run in Supabase Dashboard → SQL editor. Safe to re-run (IF NOT EXISTS).
-- The split inbox (Decide/Watching/Done) needs snooze to survive reloads.

ALTER TABLE approvals
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;

-- Optional index: the approvals list filters on snoozed_until IS NOT NULL
CREATE INDEX IF NOT EXISTS approvals_snoozed_until_idx
  ON approvals (snoozed_until)
  WHERE snoozed_until IS NOT NULL;
