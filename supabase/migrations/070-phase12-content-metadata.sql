-- ============================================================
-- PHASE 12 — CLOSE THE LOOPS
--
-- 070: content_items.metadata — the CREATE→GROW reuse path stores
-- reused_from_asset_id on the draft (GOAL 3). Nullable jsonb, no shape
-- constraint (the ledger-style metadata pattern used across the schema).
-- Re-runnable.
-- ============================================================

alter table public.content_items
  add column if not exists metadata jsonb default '{}'::jsonb;
