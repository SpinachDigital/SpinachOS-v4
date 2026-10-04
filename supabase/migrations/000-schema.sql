-- Spinach OS v4 - Supabase Schema
-- Run this in Supabase SQL Editor or via `supabase db push`
-- PostgreSQL 15+ compatible

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- HELPER FUNCTIONS (must be first - triggers depend on them)
-- ============================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CLIENTS TABLE
-- ============================================
CREATE TABLE clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    business_type TEXT NOT NULL,
    location TEXT,
    services TEXT[] DEFAULT '{}',
    goal TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_clients_status ON clients(status);
CREATE INDEX idx_clients_created_at ON clients(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- TASKS TABLE
-- ============================================
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    assigned_to TEXT,
    status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'ready', 'running', 'review', 'done', 'blocked')),
    priority INTEGER DEFAULT 0,
    dependencies UUID[] DEFAULT '{}',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tasks_client_id ON tasks(client_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_progress ON tasks(progress);
CREATE INDEX idx_tasks_created_at ON tasks(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LEADS TABLE
-- ============================================
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    source TEXT NOT NULL, -- 'github', 'hackernews', 'linkedin', 'apollo', 'manual', 'referral'
    name TEXT,
    email TEXT,
    phone TEXT,
    company TEXT,
    role TEXT,
    linkedin_url TEXT,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'proposal', 'closed_won', 'closed_lost')),
    score INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_leads_client_id ON leads(client_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CONTENT TABLE
-- ============================================
CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin', 'instagram', 'facebook', 'blog', 'newsletter', 'youtube', 'tiktok')),
    type TEXT NOT NULL CHECK (type IN ('post', 'thread', 'article', 'reel', 'story', 'carousel', 'ad_copy', 'script')),
    caption TEXT,
    media_urls TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'rejected', 'archived')),
    approval_status TEXT DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'changes_requested')),
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_content_client_id ON content(client_id);
CREATE INDEX idx_content_platform ON content(platform);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_approval_status ON content(approval_status);
CREATE INDEX idx_content_scheduled_at ON content(scheduled_at);
CREATE INDEX idx_content_created_at ON content(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_content_updated_at
    BEFORE UPDATE ON content
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- LOGS TABLE
-- ============================================
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile TEXT NOT NULL CHECK (profile IN ('ceo', 'cto', 'orchestrator', 'research', 'social', 'engineering', 'design', 'sales', 'marketing', 'content', 'ops')),
    agent TEXT, -- specific agent name if applicable
    action TEXT NOT NULL, -- 'strategy_created', 'tasks_assigned', 'leads_scraped', 'posts_drafted', 'content_approved', etc.
    input_json JSONB DEFAULT '{}',
    output_json JSONB DEFAULT '{}',
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'partial', 'failed', 'blocked')),
    duration_ms INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_logs_profile ON logs(profile);
CREATE INDEX idx_logs_agent ON logs(agent);
CREATE INDEX idx_logs_action ON logs(action);
CREATE INDEX idx_logs_status ON logs(status);
CREATE INDEX idx_logs_created_at ON logs(created_at DESC);
-- Composite for common queries
CREATE INDEX idx_logs_profile_created ON logs(profile, created_at DESC);

-- ============================================
-- WORKFLOWS TABLE
-- ============================================
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'client_pipeline', 'content_campaign', 'lead_generation', 'brand_creation'
    current_step TEXT,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'failed', 'cancelled')),
    steps_json JSONB NOT NULL DEFAULT '[]', -- array of step objects with name, status, agent, started_at, completed_at
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflows_client_id ON workflows(client_id);
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_at ON workflows(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- APPROVALS TABLE
-- ============================================
CREATE TABLE approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('content', 'outreach', 'campaign', 'spend', 'strategy', 'design', 'code')),
    title TEXT NOT NULL,
    description TEXT,
    payload_json JSONB NOT NULL, -- the actual content/data to approve
    platform TEXT, -- 'x', 'linkedin', 'meta_ads', 'google_ads', etc.
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'changes_requested', 'expired')),
    requested_by TEXT NOT NULL, -- profile that requested approval
    approved_by TEXT, -- profile that approved (Director)
    reviewed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_approvals_client_id ON approvals(client_id);
CREATE INDEX idx_approvals_type ON approvals(type);
CREATE INDEX idx_approvals_status ON approvals(status);
CREATE INDEX idx_approvals_requested_by ON approvals(requested_by);
CREATE INDEX idx_approvals_expires_at ON approvals(expires_at);
CREATE INDEX idx_approvals_created_at ON approvals(created_at DESC);

-- Updated at trigger
CREATE TRIGGER update_approvals_updated_at
    BEFORE UPDATE ON approvals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- AGENT_STATES TABLE (for real-time NPC state)
-- ============================================
CREATE TABLE agent_states (
    profile TEXT PRIMARY KEY,
    state TEXT DEFAULT 'idle' CHECK (state IN ('idle', 'thinking', 'working', 'speaking', 'blocked')),
    activity TEXT,
    current_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated at trigger
CREATE TRIGGER update_agent_states_updated_at
    BEFORE UPDATE ON agent_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DAILY_RUNS TABLE (for cron/standup tracking)
-- ============================================
CREATE TABLE daily_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_key TEXT NOT NULL, -- e.g., 'ceo_standup_daily', 'research_monday'
    run_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
    clients_processed INTEGER DEFAULT 0,
    approvals_created INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_daily_runs_job_key ON daily_runs(job_key);
CREATE INDEX idx_daily_runs_run_date ON daily_runs(run_date DESC);
CREATE INDEX idx_daily_runs_status ON daily_runs(status);
CREATE UNIQUE INDEX idx_daily_runs_job_key_date ON daily_runs(job_key, run_date);

CREATE TRIGGER update_daily_runs_updated_at
    BEFORE UPDATE ON daily_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- CALENDAR & SCHEDULING SYSTEM
-- ============================================
CREATE TABLE calendars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_type TEXT NOT NULL CHECK (owner_type IN ('agent', 'human', 'system')),
    owner_id TEXT NOT NULL, -- agent profile ID or 'director'
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT '#004B63',
    is_default BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_calendars_owner ON calendars(owner_type, owner_id);

CREATE TRIGGER update_calendars_updated_at
    BEFORE UPDATE ON calendars
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT CHECK (event_type IN ('standup', 'review', 'planning', 'deadline', 'meeting', 'reminder', 'pipeline_step', 'approval_due')),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    all_day BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT, -- RFC 5545 RRULE string
    recurrence_id UUID, -- links recurring instances
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'missed')),
    priority INTEGER DEFAULT 0,
    attendees JSONB DEFAULT '[]', -- array of agent profiles
    related_entity_type TEXT, -- 'workflow', 'approval', 'task', 'client'
    related_entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_calendar_id ON events(calendar_id);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_related ON events(related_entity_type, related_entity_id);
CREATE INDEX idx_events_recurrence ON events(recurrence_id);

CREATE TRIGGER update_events_updated_at
    BEFORE UPDATE ON events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INTERNAL COMMUNICATION SYSTEM
-- ============================================
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    channel_type TEXT DEFAULT 'public' CHECK (channel_type IN ('public', 'private', 'direct', 'announcement')),
    created_by TEXT NOT NULL, -- agent profile or 'director'
    is_archived BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channels_type ON channels(channel_type);

CREATE TRIGGER update_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE channel_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    member_type TEXT NOT NULL CHECK (member_type IN ('agent', 'human')),
    member_id TEXT NOT NULL, -- agent profile or 'director'
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'observer')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_at TIMESTAMPTZ,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    UNIQUE(channel_id, member_type, member_id)
);

CREATE INDEX idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX idx_channel_members_member ON channel_members(member_type, member_id);

CREATE TABLE threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    title TEXT,
    thread_type TEXT DEFAULT 'discussion' CHECK (thread_type IN ('discussion', 'approval', 'task', 'incident', 'announcement')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'closed', 'archived')),
    created_by_type TEXT NOT NULL CHECK (created_by_type IN ('agent', 'human')),
    created_by_id TEXT NOT NULL,
    related_entity_type TEXT, -- 'approval', 'task', 'workflow', 'client'
    related_entity_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_threads_channel ON threads(channel_id);
CREATE INDEX idx_threads_status ON threads(status);
CREATE INDEX idx_threads_related ON threads(related_entity_type, related_entity_id);
CREATE INDEX idx_threads_created_by ON threads(created_by_type, created_by_id);

CREATE TRIGGER update_threads_updated_at
    BEFORE UPDATE ON threads
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID REFERENCES threads(id) ON DELETE CASCADE,
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'human', 'system')),
    sender_id TEXT NOT NULL, -- agent profile or 'director' or 'system'
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'code', 'file', 'approval_request', 'task_update', 'system', 'mention')),
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    mentions JSONB DEFAULT '[]', -- array of {type, id} for @mentions
    attachments JSONB DEFAULT '[]', -- array of {name, url, type, size}
    metadata JSONB DEFAULT '{}',
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_thread ON messages(thread_id);
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_sender ON messages(sender_type, sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id);

-- ============================================
-- TELEGRAM INTEGRATION
-- ============================================
CREATE TABLE telegram_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL UNIQUE, -- Telegram user ID
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    role TEXT DEFAULT 'viewer' CHECK (role IN ('director', 'admin', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    language_code TEXT DEFAULT 'en',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_telegram_users_updated_at
    BEFORE UPDATE ON telegram_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE telegram_webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id BIGINT NOT NULL UNIQUE,
    message_json JSONB NOT NULL, -- raw Telegram update
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telegram_webhooks_processed ON telegram_webhooks(processed);
CREATE INDEX idx_telegram_webhooks_created ON telegram_webhooks(created_at DESC);

CREATE TABLE telegram_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_user_id UUID REFERENCES telegram_users(id) ON DELETE CASCADE,
    notification_type TEXT NOT NULL, -- 'approval_request', 'agent_alert', 'pipeline_update', 'daily_summary', 'command_result'
    title TEXT NOT NULL,
    body TEXT,
    payload_json JSONB DEFAULT '{}',
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'read')),
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    telegram_message_id BIGINT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telegram_notifications_user ON telegram_notifications(telegram_user_id);
CREATE INDEX idx_telegram_notifications_status ON telegram_notifications(status);
CREATE INDEX idx_telegram_notifications_type ON telegram_notifications(notification_type);

-- ============================================
-- WEB SCRAPER FOR LEAD GEN
-- ============================================
CREATE TABLE scraper_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    source_type TEXT NOT NULL CHECK (source_type IN ('github', 'hackernews', 'linkedin', 'apollo', 'google_maps', 'clutch', 'goodfirms', 'custom')),
    base_url TEXT,
    config JSONB DEFAULT '{}', -- selectors, pagination, auth, rate limits
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    last_run_status TEXT CHECK (last_run_status IN ('success', 'partial', 'failed')),
    last_run_leads_found INTEGER DEFAULT 0,
    schedule_cron TEXT, -- e.g., '0 6 * * *' for daily 6am
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_scraper_sources_updated_at
    BEFORE UPDATE ON scraper_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE scraper_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES scraper_sources(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    leads_found INTEGER DEFAULT 0,
    leads_new INTEGER DEFAULT 0,
    leads_updated INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scraper_runs_source ON scraper_runs(source_id);
CREATE INDEX idx_scraper_runs_status ON scraper_runs(status);
CREATE INDEX idx_scraper_runs_started ON scraper_runs(started_at DESC);

-- Extend leads table with scraper tracking
-- (adding columns via ALTER TABLE since leads table already exists)
-- ALTER TABLE leads ADD COLUMN IF NOT EXISTS scraper_source_id UUID REFERENCES scraper_sources(id);
-- ALTER TABLE leads ADD COLUMN IF NOT EXISTS scraper_run_id UUID REFERENCES scraper_runs(id);
-- ALTER TABLE leads ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}';

-- ============================================
-- SPINACH MARKETING OS (Personal Brand)
-- ============================================
CREATE TABLE marketing_content_calendar (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    slot_index INTEGER NOT NULL, -- 0-9 for 10 daily posts
    theme TEXT NOT NULL CHECK (theme IN ('politics', 'cricket', 'ai', 'github', 'quote', 'gita', 'custom')),
    platform TEXT NOT NULL CHECK (platform IN ('x', 'linkedin', 'instagram', 'threads')),
    status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'drafting', 'review', 'approved', 'scheduled', 'published', 'failed')),
    content_text TEXT,
    media_urls TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    post_id TEXT, -- platform-specific post ID
    engagement JSONB DEFAULT '{}', -- likes, retweets, replies, etc.
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, slot_index, platform)
);

CREATE INDEX idx_marketing_calendar_date ON marketing_content_calendar(date);
CREATE INDEX idx_marketing_calendar_status ON marketing_content_calendar(status);
CREATE INDEX idx_marketing_calendar_platform ON marketing_content_calendar(platform);

CREATE TRIGGER update_marketing_calendar_updated_at
    BEFORE UPDATE ON marketing_content_calendar
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE marketing_engagement (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    platform_post_id TEXT NOT NULL,
    metric_type TEXT NOT NULL, -- 'like', 'retweet', 'reply', 'quote', 'impression', 'profile_click'
    count INTEGER DEFAULT 0,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, platform_post_id, metric_type, recorded_at)
);

CREATE INDEX idx_marketing_engagement_post ON marketing_engagement(platform, platform_post_id);
CREATE INDEX idx_marketing_engagement_recorded ON marketing_engagement(recorded_at DESC);

-- Updated at trigger
CREATE TRIGGER update_agent_states_updated_at
    BEFORE UPDATE ON agent_states
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_states ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for authenticated users (simplify for single-tenant)
-- In production, add user_id column and filter by auth.uid()
CREATE POLICY "Allow all for authenticated" ON clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON leads FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON content FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON workflows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON approvals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated" ON agent_states FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Also allow service_role (for backend API)
CREATE POLICY "Allow all for service_role" ON clients FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON tasks FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON leads FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON content FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON workflows FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON approvals FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for service_role" ON agent_states FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get client with full context
CREATE OR REPLACE FUNCTION get_client_full_context(p_client_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'client', to_jsonb(c),
        'tasks', (SELECT jsonb_agg(t ORDER BY t.created_at) FROM tasks t WHERE t.client_id = c.id),
        'leads', (SELECT jsonb_agg(l ORDER BY l.created_at DESC) FROM leads l WHERE l.client_id = c.id),
        'content', (SELECT jsonb_agg(cn ORDER BY cn.created_at DESC) FROM content cn WHERE cn.client_id = c.id),
        'workflows', (SELECT jsonb_agg(w ORDER BY w.created_at DESC) FROM workflows w WHERE w.client_id = c.id),
        'approvals', (SELECT jsonb_agg(a ORDER BY a.created_at DESC) FROM approvals a WHERE a.client_id = c.id AND a.status = 'pending')
    ) INTO result
    FROM clients c
    WHERE c.id = p_client_id;
    
    RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create workflow steps
CREATE OR REPLACE FUNCTION create_workflow_steps(p_workflow_name TEXT, p_client_id UUID)
RETURNS JSONB AS $$
DECLARE
    steps JSONB;
BEGIN
    CASE p_workflow_name
        WHEN 'client_pipeline' THEN
            steps := '[
                {"name": "strategy", "status": "pending", "agent": "ceo", "description": "CEO creates growth strategy"},
                {"name": "task_breakdown", "status": "pending", "agent": "cto", "description": "CTO breaks strategy into tasks"},
                {"name": "lead_generation", "status": "pending", "agent": "sales", "description": "Sales generates leads"},
                {"name": "content_creation", "status": "pending", "agent": "content", "description": "Content creates posts/scripts"},
                {"name": "design_assets", "status": "pending", "agent": "design", "description": "Design creates visual assets"},
                {"name": "engineering_build", "status": "pending", "agent": "engineering", "description": "Engineering builds website/tech"},
                {"name": "approval_review", "status": "pending", "agent": "orchestrator", "description": "Director reviews and approves"},
                {"name": "launch", "status": "pending", "agent": "ops", "description": "Ops launches and monitors"}
            ]'::jsonb;
        WHEN 'content_campaign' THEN
            steps := '[
                {"name": "research_topics", "status": "pending", "agent": "research", "description": "Research trending topics"},
                {"name": "content_plan", "status": "pending", "agent": "content", "description": "Create content calendar"},
                {"name": "draft_creation", "status": "pending", "agent": "content", "description": "Draft posts and scripts"},
                {"name": "design_assets", "status": "pending", "agent": "design", "description": "Create visual assets"},
                {"name": "approval", "status": "pending", "agent": "orchestrator", "description": "Director approves content"},
                {"name": "schedule_publish", "status": "pending", "agent": "social", "description": "Schedule and publish"}
            ]'::jsonb;
        ELSE
            steps := '[]'::jsonb;
    END CASE;
    
    RETURN jsonb_build_object('steps', steps);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
-- Enable realtime for tables that need live updates
ALTER PUBLICATION supabase_realtime ADD TABLE clients;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE leads;
ALTER PUBLICATION supabase_realtime ADD TABLE content;
ALTER PUBLICATION supabase_realtime ADD TABLE logs;
ALTER PUBLICATION supabase_realtime ADD TABLE workflows;
ALTER PUBLICATION supabase_realtime ADD TABLE approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_states;

-- ============================================
-- INITIAL DATA (Optional - uncomment to seed)
-- ============================================
/*
INSERT INTO clients (name, business_type, location, services, goal) VALUES
('Mira Road Gym', 'Fitness', 'Mira Road, Mumbai', ARRAY['SEO', 'Meta Ads', 'Social Media'], 'Get 20 leads/month'),
('Tech Startup', 'SaaS', 'Bangalore', ARRAY['Content', 'LinkedIn', 'Website'], 'Build brand authority');
*/