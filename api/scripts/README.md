# api/scripts — probes, seeds, ops helpers

## Test-data convention (binding, 13 Oct 2026)

Every probe/seed script that writes rows to production tables MUST mark them as test data:

1. **Name prefix:** any client/lead/pipeline/asset a script creates starts with `__`
   (double underscore) — e.g. `__p81-probe-a`.
2. **is_test=TRUE:** once the `is_test` column is live (see
   `../../supabase/migration-qa-quarantine.sql` — run it in the Supabase dashboard
   SQL editor), every INSERT from a probe/seed sets `is_test = true` so production
   queries can filter `is_test = false`.
3. **Clean up after yourself:** delete the rows the script created (by `__` prefix)
   at the end of the run, or make the script idempotent by re-using one known row.
4. Production API routes filter `is_test = false` — probe data never reaches the
   founder's views even if a cleanup step is skipped.

Helpers: `qa-cleanup-probe-rows.js` (bulk probe-row purge, with backup),
`seed-model-rates.js` (idempotent P&L rate seed — rerun when new models appear).
