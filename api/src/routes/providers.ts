/*
 * routes/providers.ts — Phase 5 GOAL 8 + GOAL 9: BYOK + the publishing
 * connector registry API.
 *
 * GOAL 9: list publishers (name, connected, capabilities), connect/disconnect
 * (founder does it himself from the UI), set active provider. grow.ts calls
 * getActivePublisher() — this route only manages the registry state.
 *
 * GOAL 8: provider key management (gateway/image/embeddings). Keys stored in
 * provider_keys (DB-backed); every response returns the MASKED key only —
 * the real value never reaches the client bundle.
 */

import { app, authMiddleware } from '../ctx';
import {
  listPublishers, getPublisher, getActivePublisher, maskKey,
  getStoredKey, storeKey, deleteKey,
} from '../providers/publishing';

// -- List publishing providers (with live connection state)
app.get('/api/v1/providers/publishing', authMiddleware, async (_req, res) => {
  try {
    const base = listPublishers();
    const out = [];
    for (const p of base) {
      const impl = getPublisher(p.name)!;
      out.push({
        name: p.name,
        connected: await impl.isConnected(),
        active: ((await getActivePublisher())?.name === p.name),
        capabilities: p.capabilities,
      });
    }
    res.json(out);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -- Connect a publishing provider (founder sets the key from the UI)
app.post('/api/v1/providers/publishing/:name/connect', authMiddleware, async (req, res) => {
  try {
    const impl = getPublisher(req.params.name);
    if (!impl) return res.status(404).json({ error: `unknown provider '${req.params.name}'` });
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ error: 'token required' });
    const ok = await impl.connect({ token, baseUrl: req.body?.base_url });
    if (!ok) return res.status(500).json({ error: 'connect failed — key not stored' });
    // Response: masked key only (the real value never leaves the server).
    const stored = await getStoredKey(req.params.name);
    res.json({ ok: true, provider: impl.name, connected: true, key_masked: maskKey(stored || '') });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -- Disconnect
app.post('/api/v1/providers/publishing/:name/disconnect', authMiddleware, async (req, res) => {
  try {
    const impl = getPublisher(req.params.name);
    if (!impl) return res.status(404).json({ error: `unknown provider '${req.params.name}'` });
    const ok = await impl.disconnect();
    if (!ok) return res.status(500).json({ error: 'disconnect failed' });
    res.json({ ok: true, provider: impl.name, connected: false });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -- BYOK: provider keys (gateway / image / embeddings) — masked list
app.get('/api/v1/providers/keys', authMiddleware, async (_req, res) => {
  try {
    const { supabase } = require('../ctx');
    const { data, error } = await supabase.from('provider_keys').select('provider, label, key_ciphertext, is_active, updated_at');
    if (error) throw error;
    res.json((data || []).map((k: any) => ({
      provider: k.provider, label: k.label, is_active: k.is_active,
      key_masked: maskKey(k.key_ciphertext), updated_at: k.updated_at,
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -- BYOK: set/update a provider key (masked ack only)
app.post('/api/v1/providers/keys/:provider', authMiddleware, async (req, res) => {
  try {
    const provider = req.params.provider;
    const value = String(req.body?.key || '').trim();
    if (!value) return res.status(400).json({ error: 'key required' });
    const ok = await storeKey(provider, value, req.body?.label);
    if (!ok) return res.status(500).json({ error: 'store failed' });
    res.json({ ok: true, provider, key_masked: maskKey(value) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -- BYOK: delete a provider key
app.delete('/api/v1/providers/keys/:provider', authMiddleware, async (req, res) => {
  try {
    const ok = await deleteKey(req.params.provider);
    if (!ok) return res.status(500).json({ error: 'delete failed' });
    res.json({ ok: true, provider: req.params.provider });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// -- GOAL 8: per-department model picks (gateway/image/embeddings)
app.get('/api/v1/providers/model-picks', authMiddleware, async (_req, res) => {
  try {
    const { supabase } = require('../ctx');
    const { data, error } = await supabase.from('department_model_picks').select('*').order('department');
    if (error) throw error;
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/providers/model-picks', authMiddleware, async (req, res) => {
  try {
    const department = String(req.body?.department || '').trim();
    const capability = String(req.body?.capability || '').trim();
    const model = String(req.body?.model || '').trim();
    if (!department || !capability || !model) {
      return res.status(400).json({ error: 'department, capability, model required' });
    }
    const { supabase } = require('../ctx');
    const { data, error } = await supabase.from('department_model_picks').upsert({
      department, capability, model, updated_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    res.json({ ok: true, pick: data });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/v1/providers/model-picks/:id', authMiddleware, async (req, res) => {
  try {
    const { supabase } = require('../ctx');
    const { error } = await supabase.from('department_model_picks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
