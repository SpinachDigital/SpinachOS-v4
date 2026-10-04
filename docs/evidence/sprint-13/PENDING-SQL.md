# Sprint 13 — PENDING SQL (sirf ye EK bacha — ab run kar dena)

## STATUS (verified via live probes 2026-10-04)

| # | SQL | Status |
|---|-----|--------|
| 1 | `migration-sprint13-publish-type.sql` (approvals type + `publish`) | ✅ RUN + VERIFIED (probe PASS) |
| 2 | `migration-sprint12-playbooks-ledger.sql` (updated, idempotent) | ✅ RUN + VERIFIED (agent_memory upsert PASS) |
| 3 | **playbooks_slug_key drop** — v2 versioned packs | ❌ **STILL PENDING** |

## ❌ Pending: playbooks_slug_key (Sprint 12 nit 4 — v2 seeds blocked)

Live probe: same-slug 2-version insert STILL fails
`duplicate key value violates unique constraint "playbooks_slug_key"`
— pehle wala drop NOT drop hua (Supabase ne constraint auto-named differently kiya tha).

**Run this in Supabase SQL Editor (real constraint name find karke drop):**

```sql
-- Drop whatever slug-unique constraint exists (any name), then add composite unique
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.playbooks'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%slug%' and pg_get_constraintdef(oid) not like '%version%'
  loop
    execute format('alter table public.playbooks drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.playbooks drop constraint if exists playbooks_slug_key;
alter table public.playbooks add constraint playbooks_slug_version_key unique (slug, version);
```

**Verify (run after, result wapas paste karo):**
```sql
select conname, pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.playbooks'::regclass;
```
Expected: `playbooks_slug_version_key | UNIQUE (slug, version)` — no slug-only unique.

**Uske baad mai verify karunga:** v2 seed insert (`client-onboarding` v2) PASS + same-slug 2-version coexist PASS → Sprint 12 nit 4 fully closed.
