/*
 * routes/assets.ts — Sprint 11 §1: the REAL assets library (Sprint 10's
 * filed deliverables finally have a home). Supabase Storage buckets
 * (client-assets / deliverables / content — blueprint §2.8 folded debt):
 * real file bytes in buckets, metadata + links in the DB.
 *
 * The old /assets → /settings redirect is DELETED — /assets becomes the
 * real library page (frontend).
 *
 * Endpoints:
 *   GET    /assets                — global library (filter client/type/date)
 *   POST   /assets/upload         — founder adds assets (client + type tags,
 *                                   writes the right bucket + indexes the row)
 *   GET    /assets/:id/download   — signed URL download
 *   POST   /assets/:id/reuse      — attach/copy into a workflow or draft
 *                                   (one click, logged)
 */
import { app, authMiddleware, supabase, JWT_SECRET } from '../ctx';
import { recordMemory } from '../memory-ledger';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

// Phase 12 SECURITY: the assets library is founder-only — client sessions
// are rejected explicitly (probe: client JWT → 401 here). The library spans
// ALL clients' work; a client session must never read another client's assets.
function founderOnly(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string; role: string };
    if (decoded.role === 'client') {
      return res.status(401).json({ error: 'Founder routes only' });
    }
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token', code: 'TOKEN_INVALID' });
  }
}

// Bucket per kind (blueprint §2.8) — uploads land in the right bucket.
const BUCKET_FOR_KIND: Record<string, string> = {
  file: 'client-assets',
  image: 'client-assets',
  link: 'content',
  post: 'content',
  report: 'deliverables',
};

const ensureBuckets = async () => {
  for (const name of ['client-assets', 'deliverables', 'content']) {
    const { data: existing } = await supabase.storage.getBucket(name);
    if (!existing) {
      await supabase.storage.createBucket(name, { public: false });
      console.log(`[assets] bucket created: ${name}`);
    }
  }
};

// Buckets ensured ONCE at boot (Sprint 12 nit 4: actually boot-time — module
// level, not lazily on first request). Fire-and-forget: a bucket check must
// not delay boot; the first upload still re-checks via the lazy path.
let _bucketsEnsured = false;
void (async () => {
  try {
    await ensureBuckets();
    _bucketsEnsured = true;
    console.log('[assets] buckets ensured at boot');
  } catch (e: any) {
    console.error('[assets] boot bucket ensure failed (lazy path still active):', e?.message);
  }
})();

app.get('/api/v1/assets', founderOnly, async (req, res) => {
  try {
    if (!_bucketsEnsured) { await ensureBuckets(); _bucketsEnsured = true; }
    const { client_id, kind, since } = req.query;
    const limit = Math.min(parseInt(String(req.query.limit || '200'), 10) || 200, 1000);
    // The library = filed deliverables (Sprint 10) + uploaded assets — ONE
    // table (deliverables), no duplicate filing paths. Uploaded rows carry
    // gate_action_id = null + metadata.uploaded=true.
    let query = supabase
      .from('deliverables')
      .select('id, client_id, workflow_id, title, kind, content, file_url, version, released_by, released_at, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (client_id) query = query.eq('client_id', String(client_id));
    if (kind) query = query.eq('kind', String(kind));
    if (since) query = query.gte('created_at', String(since));
    const { data, error } = await query;
    if (error) throw error;

    // client names (bounded, one query)
    const clientIds = Array.from(new Set((data || []).map((a: any) => a.client_id).filter(Boolean)));
    const { data: clients } = clientIds.length
      ? await supabase.from('clients').select('id, name').in('id', clientIds)
      : { data: [] };
    const nameById = new Map((clients || []).map((c: any) => [c.id, c.name]));

    res.json((data || []).map((a: any) => ({
      ...a,
      client_name: nameById.get(a.client_id) || null,
      source: (a.metadata as any)?.reused_from ? 'reused' : (a.metadata as any)?.uploaded ? 'upload' : 'filed',
    })));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/assets/upload', founderOnly, async (req, res) => {
  try {
    if (!_bucketsEnsured) { await ensureBuckets(); _bucketsEnsured = true; }
    const { client_id, title, kind = 'file', content_base64, content_text, file_name } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    if (!client_id) return res.status(400).json({ error: 'client_id required — upload without a client tag is incomplete' });

    const bucket = BUCKET_FOR_KIND[String(kind)] || 'client-assets';
    let fileUrl: string | null = null;

    // Real bytes → the right bucket. Text content → stored in the row.
    if (content_base64 && file_name) {
      const bytes = Buffer.from(content_base64, 'base64');
      if (bytes.length > 25 * 1024 * 1024) return res.status(400).json({ error: 'file too large (25MB cap)' });
      const path = `${client_id}/${Date.now()}-${file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, bytes, { upsert: false });
      if (upErr) throw upErr;
      fileUrl = `${bucket}/${path}`; // storage path (signed URL on download)
    } else if (!content_text) {
      return res.status(400).json({ error: 'content_base64+file_name (binary) or content_text required' });
    }

    // Upload without indexing is incomplete — index the row (same table as
    // filed deliverables; metadata.uploaded=true marks the source).
    const { data: row, error } = await supabase.from('deliverables').insert({
      client_id,
      title,
      kind,
      content: content_text || null,
      file_url: fileUrl,
      version: 1,
      metadata: { uploaded: true, bucket, file_name: file_name || null },
    }).select().single();
    if (error) throw error;
    res.status(201).json({ ok: true, asset: row });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/assets/:id/download', founderOnly, async (req, res) => {
  try {
    const { data: asset } = await supabase.from('deliverables').select('id, title, file_url, kind').eq('id', req.params.id).single();
    if (!asset) return res.status(404).json({ error: 'asset not found' });
    if (!asset.file_url) return res.status(400).json({ error: 'no file bytes — text/link assets have no download' });
    const [bucket, ...pathParts] = asset.file_url.split('/');
    const path = pathParts.join('/');
    const { data: signed, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error || !signed) throw error || new Error('signed url failed');
    res.json({ ok: true, url: signed.signedUrl, expires_in: 3600, title: asset.title });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/assets/:id/reuse', founderOnly, async (req, res) => {
  try {
    const { workflow_id, note, target } = req.body || {};
    const { data: asset } = await supabase.from('deliverables').select('id, client_id, title, kind, content, file_url, version').eq('id', req.params.id).single();
    if (!asset) return res.status(404).json({ error: 'asset not found' });

    // Phase 12 GOAL 3 — CREATE→GROW: target 'grow_draft' prefills a GROW
    // content_items draft from the asset (title/body, metadata.reused_from_asset_id),
    // logged in the ledger. The existing workflow-target path stays unchanged.
    if (target === 'grow_draft') {
      const { data: draft, error: gErr } = await supabase.from('content_items').insert({
        title: asset.title,
        body_text: asset.content || asset.file_url || '',
        channel: 'blog',
        status: 'draft',
        created_by: 'founder',
        client_id: asset.client_id,
        metadata: { reused_from_asset_id: asset.id, source: 'asset_reuse', note: note || null },
      }).select().single();
      if (gErr) throw gErr;
      // Audit trail: a reuse nobody can see is not a reuse.
      await supabase.from('pipeline_events').insert({
        workflow_id: null, client_id: asset.client_id, event: 'asset_reused_to_grow',
        actor: 'founder',
        detail: { asset_id: asset.id, draft_id: draft.id, title: asset.title, note: note || null },
      });
      void recordMemory(supabase, {
        agent_profile: 'founder', memory_type: 'decision', key: `asset_reuse:${asset.id}:${draft.id}`,
        value: { what: 'asset reused into GROW draft', asset_id: asset.id, draft_id: draft.id, at: new Date().toISOString() },
      });
      return res.json({ ok: true, draft_id: draft.id, draft });
    }

    // Legacy path: reuse = copy the asset onto the target workflow (logged). One click.
    if (!workflow_id) return res.status(400).json({ error: 'workflow_id or target required — reuse without a target is a dead click' });

    // Reuse = copy the asset onto the target workflow (logged). One click.
    const { data: copy, error } = await supabase.from('deliverables').insert({
      client_id: asset.client_id,
      workflow_id,
      title: `${asset.title} (reused)`,
      kind: asset.kind,
      content: asset.content,
      file_url: asset.file_url,
      version: 1,
      metadata: { reused_from: asset.id, note: note || null },
    }).select().single();
    if (error) throw error;

    // Audit trail: a reuse nobody can see is not a reuse.
    await supabase.from('pipeline_events').insert({
      workflow_id, client_id: asset.client_id, event: 'asset_reused',
      actor: 'founder',
      detail: { asset_id: asset.id, copy_id: copy.id, title: asset.title, note: note || null },
    });
    res.json({ ok: true, copy });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
