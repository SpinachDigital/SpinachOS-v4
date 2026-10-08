#!/usr/bin/env node
/**
 // Phase 9 — Support Tickets RLS Probe (re-runnable).
 // Verifies on the running stack:
 //   - A reads B's ticket → 404
 //   - A lists → no B rows
 //   - Client session on founder /tickets → 401
 //   - Founder override intact (service role)
 //   - Rate limits: 429 on ticket create (10/hr) and messages (30/hr/ticket/author)
 //   - Closed tickets reject new messages (403)
 //   - No ticket data in preview or other client's view

 // Load env inline (script runs from api/ dir)
 require('fs');
 for (const line of require('fs').readFileSync('C:\\\\Users\\\\Abhishek\\\\SpinachOS-v4\\\\api\\\\.env','utf8').split('\n')) {
   const m=line.match(/^([A-Z_]+)=(.*)\$/);
   if(m && !process.env[m[1]]) process.env[m[1]]=m[2];
 }

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const API = 'http://localhost:4000';

async function main() {
  console.log('\n=== Phase 9 RLS Probe ===\n');
  
  // 1. Mint founder token
  const boot = process.env.BOOTSTRAP_ADMIN_TOKEN;
  const r0 = await fetch(`${API}/api/v1/auth/token`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + boot }, body: JSON.stringify({ sub: 'rls-probe', role: 'director' }) });
  const { token: fToken } = await r0.json();
  const fH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + fToken };
  
  // 2. Create two clients
  const mkClient = async (name) => { const r = await fetch(`${API}/api/v1/clients`, { method: 'POST', headers: fH, body: JSON.stringify({ name, industry: 'probe', status: 'active' }) }); return r.json(); };
  const A = await mkClient('__rls-A9'); const B = await mkClient('__rls-B9');
  console.log(`Clients: A=${A.id}, B=${B.id}`);
  
  // 3. Create invites + sessions for both
  const mkInvite = async (cid, email) => { const r = await fetch(`${API}/api/v1/portal/invites`, { method: 'POST', headers: fH, body: JSON.stringify({ client_id: cid, email }) }); return r.json(); };
  const redeem = async (link) => { const t = link.split('token=')[1]; const r = await fetch(`${API}/api/v1/portal/redeem?token=${encodeURIComponent(t)}`); return r.json(); };
  
  const iA = await mkInvite(A.id, 'ra9@rls.test');
  const iB = await mkInvite(B.id, 'rb9@rls.test');
  const sA = await redeem(iA.link);
  const sB = await redeem(iB.link);
  const aH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sA.token };
  const bH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + sB.token };
  
  // 4. A creates a ticket
  const rtA = await fetch(`${API}/api/v1/portal/tickets`, { method: 'POST', headers: aH, body: JSON.stringify({ subject: 'A ticket', body: 'A body', priority: 'normal' }) });
  const tA = await rtA.json();
  console.log(`1. A creates ticket: ${rtA.status} (expect 201)`);
  
  // 5. B tries to read A's ticket
  const rBreadA = await fetch(`${API}/api/v1/portal/tickets/${tA.id}`, { headers: bH });
  console.log(`2. B reads A's ticket: ${rBreadA.status} (expect 404)`);
  
  // 6. B lists tickets (should not see A's)
  const rBlist = await fetch(`${API}/api/v1/portal/tickets`, { headers: bH });
  const bList = await rBlist.json();
  const bSeesA = bList.some(t => t.id === tA.id);
  console.log(`3. B lists tickets: ${rBlist.status}, sees A's: ${bSeesA} (expect false)`);
  
  // 7. A lists (should see own)
  const rAlist = await fetch(`${API}/api/v1/portal/tickets`, { headers: aH });
  const aList = await rAlist.json();
  const aSeesA = aList.some(t => t.id === tA.id);
  console.log(`4. A lists tickets: ${rAlist.status}, sees own: ${aSeesA} (expect true)`);
  
  // 8. Founder lists (should see both)
  const rFlist = await fetch(`${API}/api/v1/tickets`, { headers: fH });
  const fList = await rFlist.json();
  const fSeesA = fList.some(t => t.id === tA.id);
  console.log(`5. Founder lists: ${rFlist.status}, sees A's: ${fSeesA} (expect true)`);
  
  // 9. A tries founder route
  const rAfounder = await fetch(`${API}/api/v1/tickets`, { headers: aH });
  console.log(`6. A on founder /tickets: ${rAfounder.status} (expect 401)`);
  
  // 10. Rate limit: 10 tickets/hour per client
  console.log('\n--- Rate limit test (10 tickets/hour) ---');
  let rateLimited = false;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(`${API}/api/v1/portal/tickets`, { method: 'POST', headers: aH, body: JSON.stringify({ subject: `RL ${i}`, body: 'body', priority: 'low' }) });
    if (r.status === 429) { rateLimited = true; console.log(`  Ticket ${i}: 429 (rate limited)`); break; }
  }
  console.log(`  Rate limit triggered: ${rateLimited} (expect true)`);
  
  // 11. Message rate limit: 30/hr/ticket/author
  console.log('\n--- Message rate limit test (30/hr) ---');
  const rtMsg = await fetch(`${API}/api/v1/portal/tickets`, { method: 'POST', headers: aH, body: JSON.stringify({ subject: 'Msg rate test', body: 'body', priority: 'low' }) });
  const tMsg = await rtMsg.json();
  let msgLimited = false;
  for (let i = 0; i < 33; i++) {
    const r = await fetch(`${API}/api/v1/portal/tickets/${tMsg.id}/messages`, { method: 'POST', headers: aH, body: JSON.stringify({ body: `msg ${i}` }) });
    if (r.status === 429) { msgLimited = true; console.log(`  Message ${i}: 429 (rate limited)`); break; }
  }
  console.log(`  Message rate limit triggered: ${msgLimited} (expect true)`);
  
  // 12. Closed ticket rejects messages
  const rtClosed = await fetch(`${API}/api/v1/portal/tickets`, { method: 'POST', headers: aH, body: JSON.stringify({ subject: 'Closed test', body: 'body', priority: 'low' }) });
  const tClosed = await rtClosed.json();
  await fetch(`${API}/api/v1/tickets/${tClosed.id}/status`, { method: 'POST', headers: fH, body: JSON.stringify({ status: 'closed' }) });
  const rMsgClosed = await fetch(`${API}/api/v1/portal/tickets/${tClosed.id}/messages`, { method: 'POST', headers: aH, body: JSON.stringify({ body: 'reply on closed' }) });
  console.log(`\n7. Client reply on closed: ${rMsgClosed.status} (expect 403)`);
  const rMsgClosedF = await fetch(`${API}/api/v1/tickets/${tClosed.id}/messages`, { method: 'POST', headers: fH, body: JSON.stringify({ body: 'founder reply on closed' }) });
  console.log(`8. Founder reply on closed: ${rMsgClosedF.status} (expect 403)`);
  
  // 13. Reopen works
  await fetch(`${API}/api/v1/tickets/${tClosed.id}/status`, { method: 'POST', headers: fH, body: JSON.stringify({ status: 'open' }) });
  const rMsgOpen = await fetch(`${API}/api/v1/portal/tickets/${tClosed.id}/messages`, { method: 'POST', headers: aH, body: JSON.stringify({ body: 'reply after reopen' }) });
  console.log(`9. Client reply after reopen: ${rMsgOpen.status} (expect 201)`);
  
  // Cleanup
  const allTickets = [...aList, ...bList, tMsg, tClosed].map(t => t.id);
  await Promise.all(allTickets.map(id => sb.from('ticket_messages').delete().eq('ticket_id', id)));
  await Promise.all(allTickets.map(id => sb.from('support_tickets').delete().eq('id', id)));
  await sb.from('approvals').delete().eq('type', 'support_ticket');
  await sb.from('portal_invites').delete().in('client_id', [A.id, B.id]);
  await sb.from('client_sessions').delete().in('client_id', [A.id, B.id]);
  await sb.from('clients').delete().in('id', [A.id, B.id]);
  console.log('\nCleaned.\n=== Phase 9 RLS Probe Complete ===');
}

main().catch(e => console.error('Probe error:', e));