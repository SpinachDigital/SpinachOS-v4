// Phase 12 GOAL 1 — REAL DELIVERY probe: key connected, full loop with a real send.
// Lead → qualify → approve → draft → approve → SEND (Resend live) → verify DB state.
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const T = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T };
const API = 'http://localhost:4000/api/v1';

(async () => {
  // 0. sender status must be connected
  const st = await (await fetch(API + '/providers/email/status', { headers: H })).json();
  console.log('0. sender:', JSON.stringify(st));
  if (!st.connected) { console.log('NOT CONNECTED — abort'); return; }

  // 1. create lead
  let r = await fetch(API + '/leads', { method: 'POST', headers: H, body: JSON.stringify({
    name: 'Delivery Probe Lead', company: 'Resend Live Test', email: 'abhishek@spinachdigital.in',
    source: 'phase12-live-delivery-probe', notes: 'GOAL 1 real-send probe — P12',
  })});
  const lead = await r.json();
  console.log('1. lead:', r.status, lead.id);
  const leadId = lead.id;

  // 2. qualify (agent scores)
  r = await fetch(API + `/leads/${leadId}/qualify`, { method: 'POST', headers: H });
  const q = await r.json();
  console.log('2. qualify:', r.status, 'score', q.score ?? q.lead?.score);

  // 3. approve the qualification card
  let cardId;
  r = await fetch(API + '/approvals?status=pending', { headers: H });
  const pending = await r.json();
  const card = (pending.items || pending).find(a => a.type === 'lead_qualified' && (a.metadata?.lead_id === leadId || a.payload?.lead_id === leadId || JSON.stringify(a).includes(leadId)));
  cardId = card?.id;
  console.log('3. approval card:', cardId || 'NOT FOUND');
  if (cardId) {
    r = await fetch(API + `/approvals/${cardId}/approve`, { method: 'POST', headers: H });
    console.log('   approve:', r.status);
  }

  // 4. draft outreach
  r = await fetch(API + `/leads/${leadId}/draft-outreach`, { method: 'POST', headers: H });
  const draft = await r.json();
  console.log('4. draft:', r.status, 'style', draft.style_score, 'draft_id', draft.draft_id || draft.id);

  // 5. NEGATIVE: send without approval → 403
  r = await fetch(API + `/leads/${leadId}/send-outreach`, { method: 'POST', headers: H });
  console.log('5. send WITHOUT approval:', r.status, r.status === 403 ? 'BLOCKED ✅' : 'GAP');

  // 6. approve the outreach card
  r = await fetch(API + '/approvals?status=pending', { headers: H });
  const pending2 = await r.json();
  const card2 = (pending2.items || pending2).find(a => (a.type === 'outreach' || a.type === 'outreach_draft') && JSON.stringify(a).includes(leadId));
  console.log('6. outreach card:', card2?.id || 'NOT FOUND');
  if (card2) {
    r = await fetch(API + `/approvals/${card2.id}/approve`, { method: 'POST', headers: H });
    console.log('   approve:', r.status);
  }

  // 7. SEND — REAL DELIVERY via Resend
  r = await fetch(API + `/leads/${leadId}/send-outreach`, { method: 'POST', headers: H });
  const send = await r.json();
  console.log('7. SEND:', r.status, JSON.stringify({ status: send.status, provider: send.provider, message_id: send.provider_message_id || send.message_id, note: (send.note || send.error || '').slice(0, 120) }));

  // 8. verify DB state: lead status, outreach_messages audit row
  const { createClient } = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: leadRow } = await sb.from('leads').select('id, status, updated_at').eq('id', leadId).single();
  console.log('8. lead row:', leadRow?.status);
  const { data: msgs } = await sb.from('outreach_messages').select('id, status, provider, provider_message_id, approved_by').eq('lead_id', leadId);
  console.log('   outreach_messages:', msgs?.length, msgs?.[0] ? `status=${msgs[0].status} provider=${msgs[0].provider} msg_id=${msgs[0].provider_message_id}` : '');
})();
