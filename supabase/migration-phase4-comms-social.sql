-- PHASE 4 PART 2/3/4 — command threads + comms channels + content calendar
-- Run in Supabase SQL editor. Idempotent.

-- ============ PART 2: command threads (two-way command bar) ============
CREATE TABLE IF NOT EXISTS command_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'fast' CHECK (mode IN ('fast', 'brainstorm', 'closed')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'delegated', 'closed')),
    client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    workflow_id UUID,
    created_by TEXT NOT NULL DEFAULT 'director',
    rounds INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_threads_status ON command_threads(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS thread_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES command_threads(id) ON DELETE CASCADE,
    sender TEXT NOT NULL,              -- 'director' | profile name | 'system'
    role TEXT NOT NULL DEFAULT 'agent',-- 'user' | 'agent' | 'system'
    content TEXT NOT NULL,
    task_id UUID,                      -- if this message delegated a task
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON thread_messages(thread_id, created_at ASC);
ALTER TABLE command_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role" ON command_threads;
CREATE POLICY "Allow all for service_role" ON command_threads FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all for service_role" ON thread_messages;
CREATE POLICY "Allow all for service_role" ON thread_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============ PART 3: war-room channels (per-workflow comms) ============
-- Reuse the existing comms channel structure; add workflow-linked channels:
ALTER TABLE channels ADD COLUMN IF NOT EXISTS workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'department' CHECK (kind IN ('department', 'workflow', 'thread'));

-- ============ PART 4: content calendar (social automation) ============
CREATE TABLE IF NOT EXISTS content_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL CHECK (brand IN ('spinach', 'abhishek')),
    platform TEXT NOT NULL CHECK (platform IN ('x', 'instagram', 'linkedin')),
    slot TIMESTAMPTZ NOT NULL,
    topic TEXT,
    status TEXT NOT NULL DEFAULT 'idea'
      CHECK (status IN ('idea','draft','qa','approved','scheduled','posted','rejected')),
    copy TEXT,                          -- the draft copy
    asset_ref TEXT,                     -- code-drawn visual reference (SVG path/id)
    approval_id UUID,                   -- links the founder approval
    scheduled_post_id TEXT,             -- platform-side id after scheduling
    metrics JSONB DEFAULT '{}',         -- impressions/likes/etc after posting
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calendar_brand_slot ON content_calendar(brand, slot);
CREATE INDEX IF NOT EXISTS idx_calendar_status ON content_calendar(status);
ALTER TABLE content_calendar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for service_role" ON content_calendar;
CREATE POLICY "Allow all for service_role" ON content_calendar FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE command_threads; EXCEPTION WHEN OTHERS THEN END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE thread_messages; EXCEPTION WHEN OTHERS THEN END; $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE content_calendar; EXCEPTION WHEN OTHERS THEN END; $$;