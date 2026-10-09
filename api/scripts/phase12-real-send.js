// Phase 12 GOAL 1 — REAL DELIVERY (owner-allowed test recipient):
// Resend test keys deliver only to the account owner's own address
// (abhi91temp@gmail.com) until a domain is verified. Full loop on that
// address → expect 200 sent + real provider message_id + audit row.
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const T = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T };
const API = 'http://localhost:4000/api/v1';
const { createClient } = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  // 1. lead with the Resend-owner address (the only allowed test recipient)
  let r = await fetch(API + '/leads', { method: 'POST', headers: H, body: JSON.stringify({
    name: 'Delivery Probe (Owner)', company: 'Resend Owner Test', email: 'abhi91temp@gmail.com',
    source: 'phase12-live-delivery-probe', notes: 'GOAL 1 real-send probe — owner address',
  })});
  const lead = await r.json();
  console.log('1. lead:', r.status, lead.id);
  const leadId = lead.id;

  // 2. qualify
  r = await fetch(API + `/leads/${leadId}/qualify`, { method: 'POST', headers: H });
  const q = await r.json();
  console.log('2. qualify:', r.status, 'score', q.score ?? q.lead?.score);

  // 3. approve the qualification card
  r = await fetch(API + '/approvals?status=pending', { headers: H });
  const pending = await r.json();
  const card = (pending.items || pending).find(a => JSON.stringify(a).includes(leadId));
  console.log('3. card:', card?.id || 'NOT FOUND');
  if (card) { r = await fetch(API + `/approvals/${card.id}/approve`, { method: 'POST', headers: H }); console.log('   approve:', r.status); }

  // 4. draft
  r = await fetch(API + `/leads/${leadId}/draft-outreach`, { method: 'POST', headers: H });
  const draft = await r.json();
  console.log('4. draft:', r.status, 'style', draft.style_score, 'id', draft.draft_id || draft.id);
  const draftId = draft.draft_id || draft.id;

  // 5. approve the outreach card
  r = await fetch(API + '/approvals?status=pending', { headers: H });
  const pending2 = await r.json();
  const card2 = (pending2.items || pending2).find(a => (a.type === 'outreach' || a.type === 'outreach_draft') && JSON.stringify(a).includes(leadId));
  console.log('5. outreach card:', card2?.id || 'NOT FOUND');
  if (card2) { r = await fetch(API + `/approvals/${card2.id}/approve`, { method: 'POST', headers: H }); console.log('   approve:', r.status); }

  // 6. REAL SEND
  r = await fetch(API + `/outreach/${draftId}/approve-and-send`, { method: 'POST', headers: H });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { console.log('6. NON-JSON:', r.status, text.slice(0, 200)); return; }
  console.log('6. SEND:', r.status, JSON.stringify({ status: j.status, provider: j.provider, message_id: j.message_id, audit_row: j.audit_row, note: (j.note || '').slice(0, 140) }));

  // 7. DB verify: audit row + draft sent + lead outreached
  const { data: leadRow } = await sb.from('leads').select('status, last_outreach_at').eq('id', leadId).single();
  console.log('7. lead:', leadRow?.status, leadRow?.last_outreach_at);
  const { data: msgs } = await sb.from('outreach_messages').select('id, channel, status, provider, provider_message_id, approved_by, sent_at').eq('lead_id', leadId);
  console.log('   audit row:', msgs?.length ? JSON.stringify({ channel: msgs[0].channel, provider: msgs[0].provider, msg_id: msgs[0].provider_message_id, approved_by: msgs[0].approved_by, sent_at: msgs[0].sent_at }) : 'MISSING');
  const { data: d } = await sb.from('outreach_drafts').select('status').eq('id', draftId).single();
  console.log('   draft:', d?.status);
})();
