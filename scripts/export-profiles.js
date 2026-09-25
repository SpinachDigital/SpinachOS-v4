// Export all 10 Hermes profiles → hermes-profiles/ (versioned source of truth).
// Exports: SOUL.md, model config (from bridge), skill-bundle LIST (names only —
// bundles are big; the verify script checks them in the live runtime), cron
// specs, auth STATE (never tokens). No secrets are copied into the repo.
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/Abhishek/SpinachOS-v4';
const HERMES = path.join(process.env.LOCALAPPDATA || 'C:/Users/Abhishek/AppData/Local', 'hermes');
const PROFILES = ['ceo','cto','orchestrator','designer','engineer','social','seo_specialist','research','sales','ads_manager'];

// bridge.ts model config (single source of truth for routing)
const MODELS = {
  ceo:            { primary: 'auto/pro-reasoning',  fallback: 'auto/best-fast', provider: 'omniroute' },
  cto:            { primary: 'auto/pro-reasoning',  fallback: 'auto/best-fast', provider: 'omniroute' },
  orchestrator:   { primary: 'auto/pro-reasoning',  fallback: 'auto/best-fast', provider: 'omniroute' },
  designer:       { primary: 'auto/best-chat',      fallback: 'auto/best-fast', provider: 'omniroute' },
  engineer:       { primary: 'auto/pro-coding',     fallback: 'auto/best-fast', provider: 'omniroute' },
  social:         { primary: 'auto/best-fast',      fallback: 'auto/best-fast', provider: 'omniroute' },
  seo_specialist: { primary: 'auto/best-reasoning', fallback: 'auto/best-fast', provider: 'omniroute' },
  research:       { primary: 'auto/best-reasoning', fallback: 'auto/best-fast', provider: 'omniroute' },
  sales:          { primary: 'auto/best-fast',      fallback: 'auto/best-fast', provider: 'omniroute' },
  ads_manager:    { primary: 'auto/pro-reasoning',  fallback: 'auto/best-fast', provider: 'omniroute', dormant: true },
};

// cron specs (from index.ts scheduler)
const CRONS = {
  ceo:            [{ name: 'ceo-monthly-strategy', spec: '0 11 1 * *', desc: 'Monthly strategy note' }],
  cto:            [{ name: 'cto-weekly-review',    spec: '0 10 * * 1', desc: 'Weekly tech review' }],
  orchestrator:   [{ name: 'standup-daily-0930',   spec: '30 9 * * 1-5', desc: 'Daily standup (weekdays)' }],
  social:         [],
  research:       [],
  sales:          [],
  designer:       [],
  engineer:       [],
  seo_specialist: [],
  ads_manager:    [],
};

let exported = 0, missing = [];
for (const p of PROFILES) {
  const live = path.join(HERMES, 'profiles', p);
  const outDir = path.join(ROOT, 'hermes-profiles', p);
  fs.mkdirSync(outDir, { recursive: true });

  // 1. SOUL.md — verbatim copy
  const soulPath = path.join(live, 'SOUL.md');
  if (fs.existsSync(soulPath)) {
    fs.copyFileSync(soulPath, path.join(outDir, 'SOUL.md'));
  } else { missing.push(p + '/SOUL.md'); }

  // 2. profile.md — model config + skill bundle list + cron + auth state
  const skillsDir = path.join(live, 'skills');
  const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter(d => fs.statSync(path.join(skillsDir, d)).isDirectory()) : [];
  const hasSpinachBundle = skills.includes('spinach-os');
  const authState = fs.existsSync(path.join(live, 'auth.json')) ? 'authed' : 'no auth.json';
  const cronDir = path.join(live, 'cron');
  const cronsLive = fs.existsSync(cronDir) ? fs.readdirSync(cronDir).filter(f => !f.includes('.')) : [];

  const md = [
    '# Profile: ' + p,
    '',
    '**Exported:** ' + new Date().toISOString(),
    '**Auth state:** ' + authState + ' (tokens never exported — live runtime only)',
    '',
    '## Model config',
    '- Primary: `' + MODELS[p].primary + '`',
    '- Fallback: `' + MODELS[p].fallback + '`',
    '- Provider: ' + MODELS[p].provider,
    '- Dormant: ' + (MODELS[p].dormant ? 'YES — auto-activates on Scale/Growth onboarding' : 'no'),
    '',
    '## Skill bundles installed (' + skills.length + ')',
    ...(hasSpinachBundle ? ['**spinach-os bundle: PRESENT** (' + (fs.existsSync(path.join(skillsDir, 'spinach-os')) ? fs.readdirSync(path.join(skillsDir, 'spinach-os')).length : 0) + ' skills)'] : ['**spinach-os bundle: MISSING — run scripts/verify-profiles.ps1 fix**']),
    '',
    '<details><summary>All bundles</summary>',
    '',
    ...skills.map(s => '- ' + s),
    '',
    '</details>',
    '',
    '## Cron jobs',
    ...(CRONS[p].length ? CRONS[p].map(c => '- `' + c.name + '` — `' + c.spec + '` — ' + c.desc) : ['- none (warm profile — woken on demand)']),
    '',
    '## Live cron dirs',
    ...(cronsLive.length ? cronsLive.map(c => '- ' + c) : ['- none']),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'profile.md'), md);
  exported++;
}
console.log('exported ' + exported + '/10 profiles → hermes-profiles/');
if (missing.length) console.log('MISSING FILES:', missing.join(', ')); else console.log('no missing SOUL.md files');
