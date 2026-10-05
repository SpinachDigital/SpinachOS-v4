# PHASE 5 — PENDING SQL + ENV (user ke liye — do cheezein)

## 1. SQL (Supabase SQL Editor, ORDER ME — pehle 1, phir 2):

**1a. migration-phase5-hardening.sql** (job_queue + laya_routing_decisions + provider_keys + department_model_picks):
MEDIA:supabase/migration-phase5-hardening.sql

**1b. migration-phase5-rls.sql** (RLS hardening — DROP every USING(true) policy via pg_policies DO-block, RLS on 25 data tables, service_role-only policies):
MEDIA:supabase/migration-phase5-rls.sql

*(RLS wala LAST me run karna — uske baad backend service_role se hi chalega, jo already hai.)*

## 2. ENV (runner ke liye — ek baar):

**DATABASE_URL** chahiye `supabase/migrations/run.js` ke liye (GOAL 3 fresh-DB proof):
- Supabase Dashboard → Settings → Database → Connection string → URI
- Format: `postgres://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`
- Export karo: `export DATABASE_URL='...'` phir `node supabase/migrations/run.js`

*(Ya runner ke bina bhi chalega — SQL Editor se hi migration order documented hai; runner fresh-DB build proof ke liye hai.)*

## VERIFY (SQL ke baad, result paste karo):
```sql
-- RLS check (zero permissive USING(true) on non-service_role expected):
select tablename, policyname, roles from pg_policies where schemaname='public' order by tablename limit 40;
-- Phase 5 tables:
select table_name from information_schema.tables where table_schema='public' and table_name in ('job_queue','laya_routing_decisions','provider_keys','department_model_picks');
```
