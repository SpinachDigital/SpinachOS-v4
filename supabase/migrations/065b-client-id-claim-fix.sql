-- ============================================================
-- 065b — PHASE 8 FIX: client_id_claim() function (standalone create)
-- 065's function creation silently skipped in some runs (schema cache);
-- this re-runnable create guarantees it exists. Idempotent.
-- ============================================================
create or replace function public.client_id_claim() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'client_id', '')::uuid;
$$;
