#!/usr/bin/env node
/*
 * migrations/run.js — Phase 5 GOAL 3: the ordered migrations runner.
 *
 * Runs every .sql in supabase/migrations/ top-to-bottom (filename order =
 * the documented order) against an empty database, tracking applied
 * migrations in schema_migrations. Idempotent: already-applied files skip.
 *
 * Usage:
 *   node supabase/migrations/run.js                 # apply pending
 *   node supabase/migrations/run.js --status        # show state only
 *
 * Connection: DATABASE_URL (postgres://...) — the direct Postgres URL from
 * the Supabase dashboard (Settings → Database → Connection string). The
 * service_role key is NOT a db password — this runner needs DATABASE_URL.
 *
 * Fresh-database proof (GOAL 3 DONE bar): a fresh Supabase project (or a
 * local Postgres) + `node supabase/migrations/run.js` builds the whole
 * schema from migrations alone, zero manual steps.
 */

const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname);
const FILES = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();

function loadPg() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set — get the direct Postgres URL from the Supabase dashboard (Settings → Database) and export it.');
    process.exit(2);
  }
  const { Client } = require('pg');
  return new Client({ connectionString: url, ssl: url.includes('localhost') ? false : { rejectUnauthorized: false } });
}

async function ensureTrackingTable(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function main() {
  const statusOnly = process.argv.includes('--status');
  const client = loadPg();
  await client.connect();
  await ensureTrackingTable(client);
  const { rows: applied } = await client.query('select filename from public.schema_migrations');
  const appliedSet = new Set(applied.map(r => r.filename));

  if (statusOnly) {
    console.log('MIGRATIONS ORDER (documented order = filename order):');
    for (const f of FILES) {
      console.log(`  ${appliedSet.has(f) ? '[x]' : '[ ]'} ${f}`);
    }
    console.log(`\n${appliedSet.size}/${FILES.length} applied`);
    await client.end();
    return;
  }

  let ran = 0, skipped = 0;
  for (const f of FILES) {
    if (appliedSet.has(f)) { skipped++; continue; }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8');
    try {
      // Multi-statement files: pg runs them in one implicit transaction per
      // query() call — a failed file rolls back whole (atomic per-file).
      await client.query(sql);
      await client.query('insert into public.schema_migrations (filename) values ($1)', [f]);
      console.log(`[x] applied ${f}`);
      ran++;
    } catch (e) {
      console.error(`[!] FAILED ${f}: ${e.message.slice(0, 200)}`);
      console.error('    Fix the file (idempotent) and re-run — applied files before it are intact.');
      await client.end();
      process.exit(1);
    }
  }
  console.log(`\nDone: ${ran} applied, ${skipped} already applied (idempotent skip). ${FILES.length} total.`);
  await client.end();
}

main().catch(e => { console.error('runner failed:', e.message); process.exit(1); });
