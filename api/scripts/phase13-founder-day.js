// PHASE 13 GOAL 4 — FOUNDER DAY-IN-THE-LIFE SHAKEDOWN.
// One continuous simulated founder day through the REAL endpoints the UI calls.
// Steps: /today open → triage 5 inbox cards (approve 3, reject 2) → qualify 3
// leads → draft+approve+send 1 outreach → onboard 1 responder → advance 1
// pipeline → file 1 deliverable → reuse 1 asset to a GROW draft → schedule 1
// post → reply to 1 ticket. Friction found → logged (fix in-phase).
const fs = require('fs');
for (const line of fs.readFileSync('C:/Users/Abhishek/SpinachOS-v4/api/.env', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const jwt = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/jsonwebtoken');
const T = jwt.sign({ sub: 'director', role: 'founder' }, process.env.JWT_SECRET, { expiresIn: '4h' });
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + T };
const API = 'http://localhost:4000/api/v1';
const { createClient } = require('C:/Users/Abhishek/SpinachOS-v4/api/node_modules/@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const friction = [];
let step = 0, pass = 0, fail = 0;
function log(name, ok, detail) {
  step++;
  ok ? pass++ : fail++;
  console.log(`STEP ${String(step).padStart(2, '0')} ${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) friction.push({ step, name, detail });
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('=== FOUNDER DAY —', new Date().toISOString(), '===\n');

  // 1. open /today (the overview endpoint the page calls)
  let r = await fetch(API + '/overview', { headers: H });
  let d = await r.json();
  log('open /today (overview)', r.status === 200 && d.today != null, `approvals_pending=${d.today?.approvals_pending}`);

  // 2-4. triage 5 inbox cards: approve 3, reject 2 (top pending, oldest first for determinism)
  r = await fetch(API + '/approvals?status=pending&limit=50', { headers: H });
  let pending = await r.json();
  pending = (pending.items || pending || []).filter(a => a.status === 'pending');
  log('fetch inbox cards', r.status === 200 && pending.length >= 5, `${pending.length} pending`);
  const targets = pending.slice(-5); // oldest 5 — least disruptive
  const approveTargets = targets.slice(0, 3);
  const rejectTargets = targets.slice(3, 5);
  for (const card of approveTargets) {
    r = await fetch(API + `/approvals/${card.id}/approve`, { method: 'POST', headers: H });
    d = await r.text();
    log(`approve card ${card.type} (${card.id.slice(0, 8)})`, r.status === 200, r.status !== 200 ? d.slice(0, 100) : '');
    await sleep(300);
  }
  for (const card of rejectTargets) {
    r = await fetch(API + `/approvals/${card.id}/reject`, { method: 'POST', headers: H, body: JSON.stringify({ reason: 'founder-day shakedown — not now' }) });
    d = await r.text();
    log(`reject card ${card.type} (${card.id.slice(0, 8)})`, r.status === 200, r.status !== 200 ? d.slice(0, 100) : '');
    await sleep(300);
  }

  // 5. qualify 3 leads (new leads, agent score)
  const leadIds = [];
  for (const n of [1, 2, 3]) {
    r = await fetch(API + '/leads', { method: 'POST', headers: H, body: JSON.stringify({
      name: `Founder Day Lead ${n}`, company: `Day Co ${n}`, email: `day${n}-${Date.now()}@example.com`,
      source: 'phase13-founder-day', notes: 'GOAL 4 shakedown lead',
    })});
    d = await r.json();
    const id = d.id;
    log(`create lead ${n}`, r.status === 201 && !!id, id?.slice(0, 8));
    if (!id) continue;
    leadIds.push(id);
    r = await fetch(API + `/leads/${id}/qualify`, { method: 'POST', headers: H });
    d = await r.json().catch(() => ({}));
    log(`qualify lead ${n}`, r.status === 200, `score ${d.score ?? d.lead?.score ?? '?'}`);
    await sleep(400);
  }

  // 6. draft + approve + send 1 outreach (lead 1, to the Resend-owner address)
  const sendLead = leadIds[0];
  if (sendLead) {
    // set the lead email to the owner address first (real delivery, allowed recipient)
    await sb.from('leads').update({ email: 'abhi91temp@gmail.com' }).eq('id', sendLead);
    // FLOW: qualify card must be APPROVED first (status qualified) — then draft.
    r = await fetch(API + '/approvals?status=pending&limit=50', { headers: H });
    pending = await r.json();
    pending = (pending.items || pending || []).filter(a => a.status === 'pending' && JSON.stringify(a).includes(sendLead));
    for (const card of pending) {
      r = await fetch(API + `/approvals/${card.id}/approve`, { method: 'POST', headers: H });
      log(`approve qualification card for send-lead (${card.type})`, r.status === 200);
    }
    r = await fetch(API + `/leads/${sendLead}/draft-outreach`, { method: 'POST', headers: H });
    d = await r.json().catch(() => ({}));
    const draftId = d.draft_id || d.id;
    log('draft outreach', r.status === 200 && !!draftId, r.status !== 200 ? (d.error || '').slice(0, 90) : `style ${d.style_score}, draft ${String(draftId).slice(0, 8)}`);
    // the draft's own card (outreach type) — approve it
    r = await fetch(API + '/approvals?status=pending&limit=50', { headers: H });
    pending = await r.json();
    const oCard = (pending.items || pending || []).find(a => a.status === 'pending' && (a.type === 'outreach' || a.type === 'outreach_draft') && JSON.stringify(a).includes(sendLead));
    if (oCard) {
      r = await fetch(API + `/approvals/${oCard.id}/approve`, { method: 'POST', headers: H });
      log('approve outreach card', r.status === 200);
    }
    if (draftId) {
      r = await fetch(API + `/outreach/${draftId}/approve-and-send`, { method: 'POST', headers: H });
      d = await r.json().catch(() => ({}));
      log('send outreach', r.status === 200 && (d.status === 'sent' || d.status === 'pending_send'), `status=${d.status}${d.message_id ? ' msg=' + String(d.message_id).slice(0, 13) : ''}${d.note ? ' note=' + d.note.slice(0, 80) : ''}`);
    }
  }

  // 7. onboard 1 responder (lead 2 → responded → onboard)
  const onboardLead = leadIds[1];
  let clientId = null, pipelineId = null;
  if (onboardLead) {
    await sb.from('leads').update({ status: 'responded' }).eq('id', onboardLead);
    r = await fetch(API + `/leads/${onboardLead}/onboard`, { method: 'POST', headers: H, body: JSON.stringify({ name: 'Founder Day Client', business_type: 'saas' }) });
    d = await r.json().catch(() => ({}));
    clientId = d.client_id; pipelineId = d.pipeline_id || d.workflow_id;
    log('onboard responder', r.status === 200 && !!clientId, `client ${String(clientId).slice(0, 8)} pipeline ${String(pipelineId).slice(0, 8)}`);
  }

  // 8. advance 1 pipeline (gate → approve → run)
  if (pipelineId) {
    r = await fetch(API + '/gates', { method: 'POST', headers: H, body: JSON.stringify({
      workflow_id: pipelineId, gate_name: 'Founder Day — advance', action: 'advance_stage', risk_tier: 'write',
      payload: { title: 'Founder Day Deliverable', kind: 'report', content: 'The founder-day shakedown deliverable.' },
    })});
    d = await r.json().catch(() => ({}));
    const gateId = d.id || d.gate_id;
    log('create advance gate', r.status === 201 && !!gateId, r.status !== 201 ? (d.error || JSON.stringify(d)).slice(0, 90) : String(gateId).slice(0, 8));
    if (gateId) {
      r = await fetch(API + `/gates/${gateId}/approve`, { method: 'POST', headers: H });
      log('approve advance gate', r.status === 200, r.status !== 200 ? (await r.text()).slice(0, 80) : '');
      r = await fetch(API + `/gates/${gateId}/run`, { method: 'POST', headers: H });
      d = await r.json().catch(() => ({}));
      log('run gate (advance + file)', r.status === 200, `filed=${!!(d.deliverable || d.filed || d.deliverable_id)} next=${d.next_step || d.current_step || ''}`);
    }
  }

  // 9. reuse 1 asset → GROW draft
  const { data: assets } = await sb.from('deliverables').select('id, title, metadata').eq('metadata->>library', 'deliverables').limit(5);
  const libAssets = (assets || []).length ? assets : (await sb.from('deliverables').select('id, title').limit(5)).data;
  if (libAssets?.length) {
    r = await fetch(API + `/assets/${libAssets[0].id}/reuse`, { method: 'POST', headers: H, body: JSON.stringify({ target: 'grow_draft' }) });
    d = await r.json().catch(() => ({}));
    log('reuse asset → GROW draft', r.status === 200 && !!(d.draft_id || d.id), `draft ${String(d.draft_id || d.id).slice(0, 8)}`);
  }

  // 10. schedule 1 post (generate → approve → schedule on the reused draft if any, else new)
  // find a draft content item to generate
  const { data: drafts } = await sb.from('content_items').select('id, status').eq('status', 'idea').limit(3);
  let contentId = null;
  const dList = drafts && drafts.length ? drafts : (await sb.from('content_items').select('id, status').eq('status', 'draft').limit(3)).data;
  if (dList?.length) {
    contentId = dList[0].id;
    r = await fetch(API + `/grow/items/${contentId}/generate`, { method: 'POST', headers: H });
    d = await r.json().catch(() => ({}));
    log('generate GROW draft', r.status === 200, `style ${d.style_score ?? '?'}`);
    // approve its card
    r = await fetch(API + '/approvals?status=pending&limit=50', { headers: H });
    pending = await r.json();
    const gCard = (pending.items || pending || []).find(a => a.status === 'pending' && JSON.stringify(a).includes(contentId));
    if (gCard) {
      r = await fetch(API + `/approvals/${gCard.id}/approve`, { method: 'POST', headers: H });
      log('approve GROW draft card', r.status === 200);
    }
    r = await fetch(API + `/grow/items/${contentId}/schedule`, { method: 'POST', headers: H, body: JSON.stringify({ scheduled_for: new Date(Date.now() + 7200_000).toISOString() }) });
    d = await r.json().catch(() => ({}));
    log('schedule post', r.status === 200 && (d.status === 'scheduled' || d.item?.status === 'scheduled'), `status=${d.status || d.item?.status}`);
  } else {
    log('schedule post', false, 'no draft/idea content item to schedule');
  }

  // 11. reply to 1 ticket (founder reply endpoint)
  // find or create an open ticket via the founder surface
  let { data: tickets } = await sb.from('support_tickets').select('id, status, client_id').in('status', ['open', 'in_progress']).limit(3);
  if (!tickets?.length) {
    // create one for a real client (the onboarded one) — same shape the portal
    // route uses: ticket row (subject) + first message row.
    const cid = clientId || (await sb.from('clients').select('id').limit(1)).data?.[0]?.id;
    if (cid) {
      const t = await sb.from('support_tickets').insert({ client_id: cid, subject: 'Founder Day — test ticket', status: 'open', priority: 'normal', unread_founder: true }).select('id').single();
      if (t.data) {
        await sb.from('ticket_messages').insert({ ticket_id: t.data.id, author: 'client', body: 'Shakedown ticket — please look at this.' });
        tickets = [t.data];
      } else {
        console.log('ticket insert error:', t.error?.message);
      }
    }
  }
  if (tickets?.length) {
    const tid = tickets[0].id;
    r = await fetch(API + `/tickets/${tid}/messages`, { method: 'POST', headers: H, body: JSON.stringify({ body: 'Founder day shakedown reply — on it.' }) });
    d = await r.json().catch(() => ({}));
    log('reply to ticket', r.status === 201, `ticket ${String(tid).slice(0, 8)}${d.id ? ' msg=' + String(d.id).slice(0, 8) : ''}`);
  } else if (clientId) {
    log('reply to ticket', false, 'no ticket + ticket insert returned null');
  } else {
    log('reply to ticket', false, 'no ticket + no client to create one');
  }

  // 12. close the day: /today again (numbers moved)
  r = await fetch(API + '/overview', { headers: H });
  d = await r.json();
  log('close the day (/today refresh)', r.status === 200 && d.today != null, `approvals_pending=${d.today?.approvals_pending} leads_new=${d.today?.leads_new}`);

  console.log(`\n=== ${pass} pass, ${fail} fail ===`);
  if (friction.length) {
    console.log('\nFRICTION LOG:');
    for (const f of friction) console.log(`  STEP ${f.step}: ${f.name} — ${f.detail}`);
  } else {
    console.log('FRICTION LOG: none — every step green.');
  }
})();
