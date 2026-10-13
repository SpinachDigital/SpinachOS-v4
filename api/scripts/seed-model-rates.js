// Seed model_rates for every model seen in usage_logs (13 Oct 2026, QA P&L fix).
// Idempotent: skips models that already have a rate row. Free-tier = honest $0.
// Re-run after adding new providers/models to the gateway.
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const { createClient } = require(path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js'));
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// usd per 1M tokens [model, in, out]. Oct 2026 market rates.
const RATES = [
  // openrouter free tier — genuinely $0, priced honestly (not "unpriced")
  ['cohere/north-mini-code:free', 0, 0],
  ['liquid/lfm-2.5-2.6b:free', 0, 0],
  ['dots-studio/dots-3-note-preview:free', 0, 0],
  ['nvidia/nemotron-3.5-lightning:free', 0, 0],
  ['poolside/laguna-xs-2.1:free', 0, 0],
  ['nvidia/nemotron-3.5-content-safety:free', 0, 0],
  ['poolside/laguna-s-2.1:free', 0, 0],
  ['nvidia/nemotron-3-ultra-550b-a55b:free', 0, 0],
  ['nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', 0, 0],
  ['openrouter/free', 0, 0],
  ['nvidia/nemotron-3-super-120b-a12b:free', 0, 0],
  // paid
  ['z-ai/glm-5.3-flash', 0.15, 0.60],
  ['glm-4.6', 0.15, 0.60],
  ['claude-sonnet-4-5', 3, 15],
  ['claude-sonnet-4-6', 3, 15],
  ['claude-opus-4-6-thinking', 15, 75],
  ['gpt-4o-mini', 0.15, 0.60],
  ['gpt-4o', 2.50, 10],
  ['gpt-oss-120b-medium', 0.10, 0.45],
  ['gemini-2.5-flash', 0.10, 0.40],
  ['gemini-3-flash', 0.10, 0.40],
  ['gemini-3-flash-preview', 0.10, 0.40],
  ['gemini-3.1-flash-lite', 0.075, 0.30],
  ['gemini-3.6-flash-tiered', 0.10, 0.40],
  ['gemini-3.7-flash-tiered', 0.10, 0.40],
  ['gemini-3.7-flash-low', 0.075, 0.30],
  ['gemini-3.7-flash-medium', 0.10, 0.40],
  ['gemini-3.7-flash-high', 0.15, 0.60],
  ['gemini-3.8-flash-high', 0.15, 0.60],
  ['gemini-3.1-pro-low', 1.00, 4.00],
  ['gemini-pro-agent', 1.25, 5.00],
  ['deepseek-v4-flash', 0.28, 0.42],
  ['veo-3.1-fast', 0, 0], // video gen — flat per-image/second cost handled in images.ts
];

(async () => {
  const { data: have } = await sb.from('model_rates').select('model').limit(500);
  const haveSet = new Set((have || []).map(r => r.model));
  const toIns = RATES.filter(([m]) => !haveSet.has(m))
    .map(([m, i, o]) => ({ model: m, usd_per_m_input: i, usd_per_m_output: o, inr_per_usd: 84 }));
  if (!toIns.length) { console.log('model_rates: nothing to add'); return; }
  const { data, error } = await sb.from('model_rates').insert(toIns).select('model');
  console.log(error ? 'ERR ' + error.message : 'model_rates: +' + data.length + ' rows');
  // report any usage_logs models still missing a rate
  const { data: logs } = await sb.from('usage_logs').select('model').limit(5000);
  const have2 = new Set((await sb.from('model_rates').select('model').limit(500)).data.map(r => r.model));
  const still = [...new Set((logs || []).map(l => l.model).filter(m => !have2.has(m)))];
  console.log(still.length ? 'still unpriced: ' + JSON.stringify(still) : 'all usage-logged models priced');
})();
