-- AUDIT FIX — relax tasks_assigned_to_check to accept v6 HOD profiles
-- The old constraint whitelists legacy dept names only, so every task routed
-- to designer/engineer/seo_specialist/ads_manager FAILS on insert.
-- Permissive pattern guard (same policy as agent_states_profile_check):
-- the app owns naming; the DB rejects only empty/garbage.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_assigned_to_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_assigned_to_check
  CHECK (assigned_to IS NULL OR assigned_to ~ '^[a-z][a-z0-9_]{1,39}$');