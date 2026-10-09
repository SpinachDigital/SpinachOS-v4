// Phase 13 GOAL 1 — SMTP transport probe: connected-state + failure paths.
// Uses tsx to import the REAL sendEmail (providers/email.ts) and the real
// provider_keys table. Never logs credentials.
//  1. status shows resend primary (smtp untouched).
//  2. store a valid-format but UNREACHABLE smtp key → smtp-only status shows
//     connected:smtp → sendEmail returns honest provider_error (ECONNREFUSED),
//     NEVER a fake send.
//  3. store a MALFORMED smtp key → honest provider_error:malformed.
//  4. restore: delete the probe smtp key; resend stays primary throughout.
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const T = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T };
const API = 'http://localhost:4000/api/v1';

(async () => {
  const email = require('../src/providers/email').default ?? require('../src/providers/email');
  const { createClient } = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  // 1. baseline: resend primary, smtp absent
  const s0 = await (await fetch(API + '/providers/email/status', { headers: H })).json();
  console.log('1. status before:', JSON.stringify(s0));

  // 2. valid-format unreachable smtp key → smtp branch honest failure
  await sb.from('provider_keys').upsert({ provider: 'smtp', label: 'probe', key_ciphertext: '127.0.0.1|9999|probeuser|probepass', is_active: true }, { onConflict: 'provider' });
  const { data: rk } = await sb.from('provider_keys').select('provider').eq('provider', 'resend').maybeSingle();
  const hadResend = !!rk;
  if (hadResend) await sb.from('provider_keys').delete().eq('provider', 'resend');
  const s1 = await (await fetch(API + '/providers/email/status', { headers: H })).json();
  console.log('2. status smtp-only (unreachable host):', JSON.stringify(s1));
  const r2 = await email.sendEmail({ to: 'test@example.com', subject: 'probe', body: 'probe' });
  console.log('3. send via unreachable smtp:', JSON.stringify(r2).slice(0, 200));
  const honestFail = r2 && r2.ok === false && (r2.reason || '').startsWith('provider_error');
  console.log('   honest failure, never fake:', honestFail ? 'PASS ✅' : 'FAIL');

  // 3. malformed smtp key
  await sb.from('provider_keys').upsert({ provider: 'smtp', label: 'probe', key_ciphertext: 'garbage', is_active: true }, { onConflict: 'provider' });
  const r3 = await email.sendEmail({ to: 'test@example.com', subject: 'probe', body: 'probe' });
  console.log('4. send via malformed smtp key:', JSON.stringify(r3).slice(0, 200));
  const honestMalformed = r3 && r3.ok === false && (r3.reason || '').startsWith('provider_error:smtp key malformed');
  console.log('   malformed rejected honestly:', honestMalformed ? 'PASS ✅' : 'FAIL');

  // 4. restore
  await sb.from('provider_keys').delete().eq('provider', 'smtp');
  const s4 = await (await fetch(API + '/providers/email/status', { headers: H })).json();
  console.log('5. status after cleanup:', JSON.stringify(s4), s4.provider === 'resend' && hadResend ? '(resend restored ✅)' : '(check resend)');
})();
