-- ============================================================
-- SPRINT 9 — WIN (§2): outreach tables + duplicate guard
-- SAFE workflow: draft → THE INBOX (approvals) → founder approves → send → logged.
-- NOTHING sends without founder approval. Re-runnable (IF NOT EXISTS).
--
-- outreach_messages: one row per outbound message (channel-limited, ToS-clean)
-- outreach_drafts:   the draft record linked to lead + approval
-- leads: add qualification columns (deterministic signals, no black-box)
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'threads', 'x')),
    subject TEXT,
    body TEXT NOT NULL,
    qualification JSONB NOT NULL DEFAULT '{}',   -- deterministic signals: budget/intent/fit + rule hits
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'sent', 'failed')),
    approval_id UUID,                            -- approvals.id — the gate (set when queued to THE INBOX)
    generated_by TEXT NOT NULL,                  -- agent profile (e.g. 'sales')
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outreach_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES outreach_drafts(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'threads', 'x')),
    subject TEXT,
    body TEXT NOT NULL,
    sent_by TEXT NOT NULL DEFAULT 'founder',     -- who triggered the send (always post-approval)
    approved_by TEXT NOT NULL,                   -- founder/director — audit trail or it didn't happen
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    provider_message_id TEXT                     -- ESP/link message id when the provider returns one
);

-- §4 indexes: every FK + ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_lead ON outreach_drafts(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_drafts_status ON outreach_drafts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_msgs_draft ON outreach_messages(draft_id);
CREATE INDEX IF NOT EXISTS idx_outreach_msgs_lead ON outreach_messages(lead_id, sent_at DESC);

-- §2 SAFETY: duplicate guard — never outreach the same lead twice per channel
CREATE UNIQUE INDEX IF NOT EXISTS uq_outreach_msgs_lead_channel ON outreach_messages(lead_id, channel);

-- Rate limits per channel/day are enforced in the API layer (hardcoded constants,
-- not configurable-by-accident): email 20/day, linkedin 10/day, threads 5/day, x 5/day.

-- RLS on (service-role API is the only writer; direct anon access denied)
ALTER TABLE outreach_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_messages ENABLE ROW LEVEL SECURITY;

-- §1 leads qualification columns (deterministic signals — no black-box "AI says qualified")
ALTER TABLE leads ADD COLUMN IF NOT EXISTS budget_signal TEXT;      -- 'has_budget' | 'unknown' | 'no_budget'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent_signal TEXT;      -- 'in_market' | 'unknown' | 'not_in_market'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fit_signal TEXT;         -- 'good_fit' | 'unknown' | 'poor_fit'
ALTER TABLE leads ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_outreach_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads(status, created_at DESC);
