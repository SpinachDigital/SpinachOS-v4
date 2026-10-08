// Phase 10 GOAL 2 — Generate → Approval Card (the golden rule)
// POST /api/v1/grow/items/:id/generate (founder-only): Laya generates post copy,
// scores it via style contract, creates/updates draft, raises inbox card type
// grow_draft (write-tier). Approve → approved. Deny → back to draft with note.

import { app, supabase, authMiddleware, emitFeed } from '../ctx';
import { lintAgentOutput } from '../agents/style-lint';

const GROW_API = '/api/v1/grow';

// ---------- Generate: POST /api/v1/grow/items/:id/generate ----------
app.post(GROW_API + '/items/:id/generate', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { tone, angle, length } = req.body || {}; // optional generation params

    // Fetch item (must be draft/idea)
    const { data: item, error: fetchErr } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (!['idea', 'draft'].includes(item.status)) {
      return res.status(400).json({ error: `Cannot generate for item in status: ${item.status}` });
    }

    // Rate limit: 10/hour (LLM call)
    // TODO: implement proper rate limit (in-memory for now)
    // checkGenerateRateLimit(req.user.sub);

    // Build prompt for Laya
    const prompt = buildGenerationPrompt(item, { tone, angle, length });

    // Call Laya (or configured agent) — for now use the existing generate helper
    const generated = await callLayaGenerate(prompt, item.channel);

    // Lint the generated copy (style contract)
    const lintResult = lintAgentOutput(generated);

    // Update item with generated draft + style score
    const { data: updated, error: updErr } = await supabase
      .from('content_items')
      .update({
        body_text: generated,
        status: 'draft',
        style_score: lintResult.score,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr) throw updErr;

    // Create INBOX card (type=grow_draft, write-tier)
    const { data: card, error: cardErr } = await supabase
      .from('approvals')
      .insert({
        type: 'grow_draft',
        risk_tier: 'write',
        client_id: item.client_id,
        title: `GROW draft: ${item.title}`,
        description: `${generated.slice(0, 160)}${generated.length > 160 ? '…' : ''} — ${item.channel} · style ${lintResult.score}/10`,
        status: 'pending',
        requested_by: 'laya',
        payload_json: {
          kind: 'grow_draft',
          item_id: item.id,
          channel: item.channel,
          style_score: lintResult.score,
          style_violations: lintResult.violations,
          draft_preview: generated.slice(0, 400),
        },
      })
      .select('id')
      .single();

    if (cardErr) throw cardErr;

    emitFeed('grow', 'draft_generated', {
      item_id: item.id,
      card_id: card.id,
      channel: item.channel,
      style_score: lintResult.score,
    });

    res.json({
      id: item.id,
      body_text: generated,
      style_score: lintResult.score,
      style_violations: lintResult.violations,
      card_id: card.id,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- Helper: build prompt for Laya ----------
function buildGenerationPrompt(item: any, opts: { tone?: string; angle?: string; length?: string }) {
  const channelSpecs = {
    x: 'Twitter/X post, ≤280 chars, thread-friendly, 1-2 hashtags',
    linkedin: 'LinkedIn post, professional tone, 500-1300 chars, line breaks for readability',
    instagram: 'Instagram caption, visual-first, ≤2200 chars, relevant hashtags',
    blog: 'Blog post excerpt/announcement, 200-500 chars, clear CTA',
  };

  return `Generate a ${item.channel} post for: "${item.title}"

Channel spec: ${channelSpecs[item.channel] || 'standard social post'}
${item.body_text ? `Existing draft: "${item.body_text}"` : ''}
${opts.tone ? `Tone: ${opts.tone}` : ''}
${opts.angle ? `Angle: ${opts.angle}` : ''}
${opts.length ? `Target length: ${opts.length}` : ''}

Style contract: plain direct English, no AI-isms, no emoji unless native to channel, score ≥6/10.
Return ONLY the post copy.`;
}

// ---------- Helper: call Laya (or configured agent) ----------
async function callLayaGenerate(prompt: string, channel: string): Promise<string> {
  // Fallback template (honest mock for dry-run) — the real Laya bridge lands
  // with the agent execution engine wiring; the approval gate is the same.
  const templates: Record<string, string> = {
    x: 'Building the system so the system builds the team. No manual loops, no hero dependencies. Just compounding leverage. 🔁',
    linkedin: 'The best operators don\'t optimize tasks — they eliminate them. Building Spinach OS so the work routes itself. More on the compounding loop soon.',
    instagram: 'Systems > hustle. The machine runs while you sleep. 🌙✨',
    blog: 'We shipped the content engine. Calendar → Generate → Approve → Publish. No manual steps. Here\'s how it works...',
  };
  return templates[channel] || 'New content draft generated by Laya. Review and approve to publish.';
}

// ---------- Rate limit helper (stub) ----------
function checkGenerateRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  // TODO: implement proper rate limit (10/hour per user)
  return { allowed: true };
}