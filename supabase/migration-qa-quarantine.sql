-- QA test-data quarantine (13 Oct 2026) — one-shot, idempotent.
-- 1) is_test column on production tables (default FALSE).
-- 2) Tag known probe/seed rows as is_test=TRUE.
-- 3) DELETE the probe rows (batch seeds, probe clients) from production.
-- Safe to re-run: every step guards on existence (IF NOT EXISTS / WHERE).
-- Table names match the API's actual usage: workflows (=pipelines in the UI),
-- deliverables (=asset library in the UI), content_items, leads, clients.
-- Backups taken before running: docs/evidence/qa-quarantine-backup/*.json.

-- ─── step 1: columns ───
ALTER TABLE leads         ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
ALTER TABLE clients       ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
ALTER TABLE workflows     ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
ALTER TABLE deliverables  ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;
ALTER TABLE content_items ADD COLUMN IF NOT EXISTS is_test boolean DEFAULT false;

-- ─── step 2: tag (from the 13 Oct inventory) ───
-- clients: __* probe prefix + explicit test-named clients
UPDATE clients SET is_test = true
WHERE name LIKE '\_\_%' ESCAPE '\' OR name ILIKE 'test%' OR name ILIKE '%qa test%';

-- leads: batch-import seed rows + probe-sourced
UPDATE leads SET is_test = true
WHERE name LIKE 'Batch Lead%' OR source IN ('probe', 'test') OR name ILIKE 'test%';

-- workflows: QA/test/probe-named
UPDATE workflows SET is_test = true
WHERE name ILIKE '%qa workflow%' OR name ILIKE '%probe%' OR name ILIKE '%test%';

-- deliverables: probe rows
UPDATE deliverables SET is_test = true
WHERE title ILIKE '%probe%' OR title LIKE '\_\_%' ESCAPE '\';

-- content_items: test posts
UPDATE content_items SET is_test = true
WHERE title ILIKE '%test%' OR content_text ILIKE '%probe%' OR title LIKE '\_\_%' ESCAPE '\';

-- ─── step 3: DELETE probe/seed rows (keep founder's real data) ───
-- approvals reference client_id — remove test-client approvals first.
DELETE FROM approvals WHERE client_id IN (SELECT id FROM clients WHERE is_test = true);
DELETE FROM clients        WHERE is_test = true;
DELETE FROM leads          WHERE is_test = true AND name LIKE 'Batch Lead%';
DELETE FROM workflows      WHERE is_test = true AND (name ILIKE '%qa workflow%' OR name ILIKE '%probe%');
DELETE FROM deliverables   WHERE is_test = true AND title ILIKE '%probe%';
DELETE FROM content_items  WHERE is_test = true AND (title ILIKE '%test%' OR title LIKE '\_\_%' ESCAPE '\');

-- ─── step 4: verify ───
SELECT 'clients' t, count(*) FILTER (WHERE is_test) tagged, count(*) total FROM clients
UNION ALL SELECT 'leads', count(*) FILTER (WHERE is_test), count(*) FROM leads
UNION ALL SELECT 'workflows', count(*) FILTER (WHERE is_test), count(*) FROM workflows
UNION ALL SELECT 'deliverables', count(*) FILTER (WHERE is_test), count(*) FROM deliverables
UNION ALL SELECT 'content_items', count(*) FILTER (WHERE is_test), count(*) FROM content_items;
