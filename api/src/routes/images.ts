/*
 * routes/images.ts — Sprint 8 §6: image generation wiring (honest).
 *
 * The real image endpoint is the Hermes image_gen plugin (provider
 * 'openai-codex', model 'gpt-image-2-medium') — it generates to
 * %LOCALAPPDATA%/hermes/cache/images/ and returns an absolute file path.
 * OmniRoute's /v1/images/generations exists but has no codex credentials
 * ("No credentials for image provider: codex") — we do NOT duplicate that
 * pipeline or fake results.
 *
 * This route serves generated images from the Hermes image cache so the
 * chat surface can render them, and records generation requests in
 * task_outputs (kind='image') when they belong to a task.
 *
 * POST /api/v1/images/generate { prompt, task_id?, aspect_ratio? }
 *   → { ok, image_url, provider, model, generated_at }
 *     image_url = /api/v1/images/file/<name> (served by GET below)
 * GET  /api/v1/images/file/:name  → the PNG bytes (Hermes cache, name-validated)
 */
import { app, authMiddleware, supabase } from '../ctx';
import * as path from 'path';
import * as fs from 'fs';

// Hermes image cache (the image_gen plugin writes here). Env-driven so the
// dashboard works on any machine; default is the standard Windows path.
const IMAGE_CACHE = process.env.HERMES_IMAGE_CACHE
  || path.join(process.env.LOCALAPPDATA || 'C:\\Users\\Abhishek\\AppData\\Local', 'hermes', 'cache', 'images');

// Only PNG/JPG/WEBP basenames — path traversal is a bug, not a feature.
const SAFE_NAME = /^[\w-]+\.(png|jpe?g|webp)$/i;

app.get('/api/v1/images/file/:name', authMiddleware, (req, res) => {
  const name = String(req.params.name || '');
  if (!SAFE_NAME.test(name)) return res.status(400).json({ error: 'invalid image name' });
  const file = path.join(IMAGE_CACHE, name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'image not found', name });
  res.sendFile(file);
});

app.post('/api/v1/images/generate', authMiddleware, async (req, res) => {
  try {
    const { prompt, task_id, aspect_ratio } = req.body || {};
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: 'prompt required' });

    // Honest wiring: the Hermes image_gen plugin is the real endpoint. This API
    // process cannot invoke Hermes tools directly — the dashboard chat calls the
    // plugin through its own host (window.hermes), which writes the PNG to the
    // cache and returns the path. This route then:
    //   1. records the generation as a task_output (kind='image') when task_id is given
    //   2. serves the file bytes back (GET /api/v1/images/file/:name)
    // If the plugin has not generated yet, we say so — no fake "generated" placeholder.
    const { file_name } = req.body || {};
    if (file_name && SAFE_NAME.test(String(file_name))) {
      const file = path.join(IMAGE_CACHE, String(file_name));
      if (!fs.existsSync(file)) {
        return res.status(404).json({ error: 'image not found in Hermes cache', file_name, hint: 'generate it with the Hermes image_gen plugin first' });
      }
      let saved: any = null;
      if (task_id) {
        const { data, error } = await supabase.from('task_outputs').insert({
          task_id: String(task_id),
          kind: 'image',
          title: String(prompt).slice(0, 80),
          body: `/api/v1/images/file/${file_name}`,
          meta: { provider: 'openai-codex', model: 'gpt-image-2-medium', generated_at: new Date().toISOString() },
        }).select().single();
        if (error) return res.status(500).json({ error: `task_output insert failed: ${error.message}` });
        saved = data;
      }
      return res.status(201).json({
        ok: true,
        image_url: `/api/v1/images/file/${file_name}`,
        provider: 'openai-codex',
        model: 'gpt-image-2-medium',
        generated_at: new Date().toISOString(),
        task_output: saved,
      });
    }

    // No file_name: the caller must generate via the Hermes plugin first.
    return res.status(400).json({
      error: 'no image file provided',
      hint: 'the real endpoint is the Hermes image_gen plugin (provider openai-codex, model gpt-image-2-medium); generate first, then POST { prompt, file_name } here to record + serve it',
      provider_status: 'omniroute codex credentials missing — Hermes plugin is the working path',
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
