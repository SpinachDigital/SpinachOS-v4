/**
 * Sprint 5b: HR seed script — upsert every hermes-profiles/<dir>/ into hr_agents
 * (id = dir name). Re-runnable: upsert on id, never duplicates.
 *
 * Run: npx tsx src/scripts/seed-hr-agents.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const PROFILES_DIR = path.resolve(__dirname, '../../../hermes-profiles');

// profile → department/role/specialization map (SpinachOS org structure).
// Anything not in the map defaults to department 'ops', role = dir name.
const ORG: Record<string, { department: string; role: string; specialization?: string; skills: string[] }> = {
  orchestrator: { department: 'command', role: 'Orchestrator', specialization: 'Coordination & dispatch', skills: ['orchestration', 'dispatch', 'kanban'] },
  ceo: { department: 'command', role: 'CEO Agent', specialization: 'Strategy & goals', skills: ['strategy', 'planning', 'review'] },
  cto: { department: 'engineering', role: 'CTO Agent', specialization: 'Architecture & code review', skills: ['architecture', 'code-review', 'supabase'] },
  engineer: { department: 'engineering', role: 'Engineer', specialization: 'Full-stack build', skills: ['typescript', 'react', 'node', 'supabase'] },
  designer: { department: 'design', role: 'Designer', specialization: 'UI/UX & brand', skills: ['figma', 'ui-ux', 'brand'] },
  seo_specialist: { department: 'marketing', role: 'SEO Specialist', specialization: 'Search & content SEO', skills: ['seo', 'keyword-research', 'analytics'] },
  social: { department: 'marketing', role: 'Social Media Agent', specialization: 'X/IG/LinkedIn posting', skills: ['x', 'instagram', 'linkedin'] },
  ads_manager: { department: 'marketing', role: 'Ads Manager', specialization: 'Meta/Google ads', skills: ['meta-ads', 'google-ads', 'budgets'] },
  sales: { department: 'sales', role: 'Sales Agent', specialization: 'Leads & outreach', skills: ['outreach', 'crm', 'followups'] },
  research: { department: 'command', role: 'Research Agent', specialization: 'Domain research & monitoring', skills: ['research', 'monitoring', 'citations'] },
};

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('ERR: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (source api/.env first)');
    process.exit(1);
  }
  const sb = createClient(url, key);

  if (!fs.existsSync(PROFILES_DIR)) {
    console.error(`ERR: profiles dir not found: ${PROFILES_DIR}`);
    process.exit(1);
  }

  const dirs = fs.readdirSync(PROFILES_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  if (dirs.length === 0) {
    console.error('ERR: no profile dirs found');
    process.exit(1);
  }

  let upserted = 0;
  for (const dir of dirs) {
    const org = ORG[dir] || { department: 'ops', role: dir, skills: [] as string[] };
    const { error } = await sb.from('hr_agents').upsert(
      {
        id: dir, // = agent_states.profile
        name: dir.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        department: org.department,
        role: org.role,
        specialization: org.specialization || null,
        skills: org.skills,
        status: 'active',
      },
      { onConflict: 'id' },
    );
    if (error) {
      console.error(`  FAIL ${dir}: ${error.message}`);
    } else {
      upserted++;
      console.log(`  ok ${dir} → ${org.department} / ${org.role}`);
    }
  }

  // verify
  const { count } = await sb.from('hr_agents').select('id', { count: 'exact', head: true });
  console.log(`SEED DONE: ${upserted}/${dirs.length} upserted, hr_agents total = ${count}`);
  if (count !== dirs.length) {
    console.error('WARN: count mismatch — re-run the script (it is re-runnable)');
    process.exit(2);
  }
}

main().catch(e => { console.error('SEED FAILED:', e.message); process.exit(1); });
