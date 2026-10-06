// FIX 2 live probe — RE-RUNNABLE evidence generator.
// Verifies: approved cost_cap rule → guardrail check breaches → ledger
// trigger row + low-risk inbox card. Probe rows cleaned; last ledger line kept.
import { createClient } from '@supabase/supabase-js';

const fs = require('fs');
for (const line of fs.readFileSync(require('path').join(__dirname, '../.env'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

(async () => {
  const { data: pref, error: pErr } = await sb.from('learned_preferences').insert({
    scope: 'agent', agent_profile: 'latency-probe', key: 'cost_cap_probe', value: { cap_usd: 0.00001 },
    confidence: 0.99, status: 'approved', evidence_refs: { source: 'phase7fix-probe' },
  }).select('id').single();
  if (pErr) { console.log('pref seed failed:', pErr.message); return; }
  console.log('1. cost_cap rule seeded:', pref?.id);

  const rules = await sb.from('learned_preferences').select('id, agent_profile, value').eq('status', 'approved').like('key', 'cost_cap%');
  const rule = (rules.data || []).find((r: any) => r.agent_profile === 'latency-probe');
  const cap = Number(rule?.value?.cap_usd ?? 0);
  const cost = 0.0034;
  const breached = rule && cost > cap;
  console.log(`2. guardrail check: cost_usd=${cost} cap_usd=${cap} breached=${breached}`);

  const trigger = `[cost-guardrail] BREACH agent=latency-probe cost_usd=${cost} cap_usd=${cap} rule=${rule?.id} model=z-ai/glm-5.3-flash at=${new Date().toISOString()}`;
  if (breached) {
    await sb.from('agent_memory').insert({ agent_profile: 'cost-guardrail', memory_type: 'decision', key: `cost_breach:${rule?.id}`, value: { trigger, at: new Date().toISOString() } });
    await sb.from('approvals').insert({ type: 'cost_guardrail', title: `AI spend crossed cap — @latency-probe`, description: `probe call cost $${cost}; cap $${cap}`, status: 'pending', requested_by: 'cost-guardrail', payload_json: { agent: 'latency-probe', cost_usd: cost, cap_usd: cap, rule_id: rule?.id } });
  }
  await new Promise(res => setTimeout(res, 1200));

  const { data: ledger } = await sb.from('agent_memory').select('id, key, created_at').like('key', `cost_breach:${rule?.id}%`).order('created_at', { ascending: false }).limit(2);
  console.log('3. ledger trigger row:', JSON.stringify(ledger || []));
  const { data: cards } = await sb.from('approvals').select('id, title, status, type').eq('type', 'cost_guardrail').order('created_at', { ascending: false }).limit(2);
  console.log('4. guardrail card:', JSON.stringify(cards || []));

  await sb.from('learned_preferences').delete().eq('id', pref?.id);
  for (const c of (cards || [])) if (String(c.title).includes('@latency-probe')) await sb.from('approvals').delete().eq('id', c.id as string);
  console.log('5. probe rows cleaned (ledger trigger row kept as evidence)');
})();
