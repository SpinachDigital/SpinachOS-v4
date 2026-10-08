// Phase 11 screenshots — REAL captures via CDP headless Chrome.
// Steps: leads (pipeline view), inbox (lead_qualified + outreach cards), onboarded (client page).
// Founder token seeded via /api/auth/session (same as Phase 10 invites).
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const OUT_DIR = 'C:/Users/Abhishek/SpinachOS-v4/docs/evidence/phase-11';

(async () => {
  const browser = await puppeteer.connect({ browserURL: 'http://localhost:9223', defaultViewport: { width: 1440, height: 900 } });
  const step = process.argv[2];
  const page = await browser.newPage();

  // founder session (command-center mints via /api/auth/session → localStorage)
  await page.goto('http://localhost:3000/api/auth/session', { waitUntil: 'networkidle2', timeout: 30000 });
  const sessText = await page.evaluate(() => document.body.innerText);
  let founderToken = null;
  try { founderToken = JSON.parse(sessText).token; } catch { }
  if (!founderToken) { console.log('ERROR: no founder token'); process.exit(4); }
  await page.evaluate((t) => {
    localStorage.setItem('spinach_token_cache', JSON.stringify({ token: t, expires_at: Date.now() + 3600_000 }));
  }, founderToken);

  if (step === 'leads') {
    // WIN pipeline view — stages with real leads (new/qualified/outreached/responded/onboarded)
    await page.goto('http://localhost:3000/leads', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('pipeline visible:', /WIN — leads pipeline/i.test(txt));
    const file = `${OUT_DIR}/leads-pipeline.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  if (step === 'qualify-card') {
    // THE INBOX with a PENDING lead_qualified card (score + rationale visible).
    // Fetch a pending lead_qualified card from the API, then scroll to that
    // exact card in the DOM (the queue is triage-sorted — 100+ cards deep).
    const apiRes = await fetch('http://localhost:4000/api/v1/approvals?limit=200', { headers: { Authorization: `Bearer ${founderToken}` } });
    const all = await apiRes.json();
    const card = (all || []).find(a => a.type === 'lead_qualified' && a.status === 'pending');
    console.log('pending lead_qualified card:', card ? `${card.id.slice(0, 8)} "${card.title}"` : 'NONE — creating one via API');
    let cardTitle = card?.title;
    if (!card) {
      // create one: fresh lead → qualify
      const leadRes = await fetch('http://localhost:4000/api/v1/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${founderToken}` },
        body: JSON.stringify({ name: 'Shot Lead', email: `shot-${Date.now()}@shotlab.co`, company: 'ShotLab', source: 'inbound' }),
      });
      const lead = await leadRes.json();
      const qRes = await fetch(`http://localhost:4000/api/v1/leads/${lead.id}/qualify`, { method: 'POST', headers: { Authorization: `Bearer ${founderToken}` } });
      const q = await qRes.json();
      cardTitle = (await (await fetch(`http://localhost:4000/api/v1/approvals?limit=200`, { headers: { Authorization: `Bearer ${founderToken}` } })).json())
        .find(a => a.id === q.card_id)?.title;
      console.log('created card:', q.card_id?.slice(0, 8), cardTitle);
    }
    await page.goto('http://localhost:3000/approvals', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    const scrolled = await page.evaluate((title) => {
      const arts = [...document.querySelectorAll('article')];
      const el = arts.find(a => (a.textContent || '').includes(title || 'Lead qualified'));
      if (el) { el.scrollIntoView({ block: 'start' }); return true; }
      return false;
    }, cardTitle);
    console.log('card scrolled into view:', scrolled);
    await new Promise(r => setTimeout(r, 1500));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('qualify card visible:', /Lead qualified/i.test(txt));
    const file = `${OUT_DIR}/qualify-card.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  if (step === 'outreach-draft') {
    // THE INBOX with the outreach_draft card (style score on the card).
    // Fetch a pending outreach card from the API, then scroll to it.
    const apiRes = await fetch('http://localhost:4000/api/v1/approvals?limit=200', { headers: { Authorization: `Bearer ${founderToken}` } });
    const all = await apiRes.json();
    const card = (all || []).find(a => a.type === 'outreach' && a.status === 'pending');
    console.log('pending outreach card:', card ? `${card.id.slice(0, 8)} "${card.title}"` : 'NONE found');
    if (!card) { console.log('ERROR: no pending outreach card to show'); process.exit(6); }
    await page.goto('http://localhost:3000/approvals', { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    const scrolled = await page.evaluate((title) => {
      const arts = [...document.querySelectorAll('article')];
      const el = arts.find(a => (a.textContent || '').includes(title));
      if (el) { el.scrollIntoView({ block: 'start' }); return true; }
      return false;
    }, card.title);
    console.log('card scrolled into view:', scrolled);
    await new Promise(r => setTimeout(r, 1500));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('outreach card visible:', /Outreach email/i.test(txt));
    const file = `${OUT_DIR}/outreach-draft-card.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  if (step === 'onboarded') {
    // client page of the onboarded lead's client (pipeline seeded from pack)
    // read the latest onboarded lead's client id from the API
    const r = await fetch('http://localhost:4000/api/v1/leads?status=onboarded', { headers: { Authorization: `Bearer ${founderToken}` } });
    const leads = await r.json();
    const last = (leads || []).filter(l => l.client_id).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))[0];
    if (!last) { console.log('ERROR: no onboarded lead with client_id'); process.exit(5); }
    console.log('onboarded lead:', last.id?.slice(0, 8), 'client:', last.client_id?.slice(0, 8));
    await page.goto(`http://localhost:3000/clients/${last.client_id}`, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3500));
    const txt = await page.evaluate(() => document.body.innerText);
    console.log('client page visible:', /Client Portal|Active|Pipeline|Workflow/i.test(txt));
    const file = `${OUT_DIR}/onboarded-client-pipeline.png`;
    await page.screenshot({ path: file });
    console.log('SAVED', file, fs.statSync(file).size, 'bytes');
  }

  await browser.disconnect();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
