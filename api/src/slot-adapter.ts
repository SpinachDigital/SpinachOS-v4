/*
 * src/slot-adapter.ts — N3 §0: the LAST seam close.
 * content_items IS the calendar (N2 unification). This adapter gives the
 * grow scheduler + approvals gate a legacy-slot-shaped VIEW of a canonical
 * row, so the publish path (founder X daily poster) runs on content_items
 * with zero ambiguity. Statuses (CHECK constraint, probed live):
 *   idea | draft | scheduled | published | failed | approved
 * review stage lives in metadata.review — the gate reads status='draft'
 * AND metadata.review=true. marketing_content_calendar is NEVER read here.
 */
import { supabase } from './ctx';

export type LegacySlot = {
  id: string;
  status: string;                 // legacy vocabulary
  topic: string | null;
  date: string | null;
  slot_index: number;
  theme: string | null;
  platform: string;
  content_text: string | null;
  scheduled_at: string | null;
  metadata: Record<string, unknown>;
  post_id: string | null;
  published_at: string | null;
  asset_ref: string | null;       // lives in metadata (Sprint 13, schema-honest)
};

/** canonical → legacy-shape view (write paths keep using canonical fields). */
export function toLegacySlot(c: any): LegacySlot {
  return {
    id: c.id,
    status: c.status === 'idea' ? 'planned'
      : c.status === 'draft' ? (((c.metadata as any)?.review) ? 'review' : 'drafting')
      : c.status === 'approved' ? 'scheduled'
      : c.status,
    topic: (c.metadata as any)?.topic ?? null,
    date: (c.scheduled_for || '').slice(0, 10) || null,
    slot_index: (c.metadata as any)?.slot_index ?? 0,
    theme: (c.metadata as any)?.theme ?? null,
    platform: c.channel,
    content_text: c.body_text,
    scheduled_at: c.scheduled_for,
    metadata: c.metadata || {},
    post_id: c.provider_post_id,
    published_at: c.published_at,
    asset_ref: (c.metadata as any)?.asset_ref ?? null,
  };
}

/** fetch one slot (legacy view) — returns null when missing. */
export async function getSlot(supabase: any, slotId: string): Promise<LegacySlot | null> {
  const { data, error } = await supabase.from('content_items').select('*').eq('id', slotId).single();
  if (error || !data) return null;
  return toLegacySlot(data);
}

/**
 * canonical write-patch from legacy vocabulary. Status map (CHECK probed):
 * planned→idea, drafting/review→draft. Field map: content_text→body_text,
 * scheduled_at→scheduled_for, post_id→provider_post_id, error→error.
 * Metadata merges stay the caller's job (they need the current metadata).
 */
export function ciUpdate(patch: Record<string, unknown>): Record<string, unknown> {
  const u: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status !== undefined) {
    u.status = ({ planned: 'idea', drafting: 'draft', review: 'draft' } as Record<string, string>)[String(patch.status)] ?? patch.status;
  }
  if (patch.content_text !== undefined) u.body_text = patch.content_text;
  if (patch.scheduled_at !== undefined) u.scheduled_for = patch.scheduled_at;
  if (patch.published_at !== undefined) u.published_at = patch.published_at;
  if (patch.post_id !== undefined) u.provider_post_id = patch.post_id;
  if (patch.error !== undefined) u.error = patch.error;
  return u;
}
