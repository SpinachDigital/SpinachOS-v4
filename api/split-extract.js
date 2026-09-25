// Phase 3 — monolith splitter v2: extract route domains using TRUE boundaries
// (each range starts at the first app./const/function line of its domain and
// ends just before the next domain's first line). No off-by-ones.
const fs = require('fs');
const path = require('path');

const lines = fs.readFileSync('src/index.ts', 'utf8').split('\n');
// lines[] 0-indexed → helper: inclusive 1-indexed slice
const slice = (a, b) => lines.slice(a - 1, b).join('\n');

// Domain → [startLine, endLine(inclusive, = nextDomainStart-1 or file section end)]
// Boundaries verified against grep of ^app\. starts (2026-09-25).
const SPLIT = [
  { file: 'routes/models.ts',      ranges: [[251, 286]] },
  { file: 'routes/agents.ts',      ranges: [[516, 626]] },
  { file: 'routes/cron.ts',        ranges: [[679, 709]] },
  { file: 'routes/kanban.ts',      ranges: [[710, 778]] },
  { file: 'routes/approvals.ts',   ranges: [[779, 892]] },
  { file: 'routes/clients.ts',     ranges: [[893, 1169]] },
  { file: 'routes/knowledge.ts',   ranges: [[1170, 1339]] },
  { file: 'routes/workflows.ts',   ranges: [[1340, 1441]] },
  { file: 'routes/hr.ts',          ranges: [[1442, 1897]] },
  { file: 'routes/standup.ts',     ranges: [[1898, 2020]] },
  { file: 'routes/pipeline.ts',    ranges: [[2021, 2115]] },
  { file: 'routes/retainer.ts',    ranges: [[2116, 2297]] },
  { file: 'routes/command.ts',     ranges: [[2298, 2512], [2513, 2780]] },
  { file: 'routes/laya.ts',        ranges: [[2781, 2918]] },
  { file: 'routes/calendar.ts',    ranges: [[2919, 3094]] },
  { file: 'routes/comms.ts',       ranges: [[3095, 3250]] },
  { file: 'routes/scrapers.ts',    ranges: [[3251, 3408]] },
  { file: 'routes/telegram.ts',    ranges: [[3409, 3541]] },
  { file: 'routes/marketing.ts',   ranges: [[3542, 3724]] },
  { file: 'routes/dashboard.ts',   ranges: [[3725, 3999]] },
  { file: 'engines/pipeline-qa.ts', ranges: [[4020, 4052]] },
  { file: 'engines/pipeline-run.ts', ranges: [[4053, 4275]] },
];

fs.mkdirSync('src/routes', { recursive: true });
fs.mkdirSync('src/engines', { recursive: true });

for (const s of SPLIT) {
  const body = s.ranges.map(([a, b]) => slice(a, b)).join('\n');
  // trim leading blank lines + trailing blanks
  const trimmed = body.replace(/^\n+/, '').replace(/\n+$/, '');
  const header = `/*
 * ${s.file} — Phase 3 monolith split (from index.ts ${s.ranges.map(([a,b])=>`L${a}–${b}`).join(' + ')}).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */
`;
  fs.writeFileSync(path.join('src', s.file), header + trimmed + '\n');
  console.log('wrote', s.file, '(' + trimmed.split('\n').length + ' lines)');
}
console.log('done v2');
