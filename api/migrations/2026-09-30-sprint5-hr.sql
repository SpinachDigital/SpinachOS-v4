-- ============================================================
-- SPRINT 5 — HR DEPARTMENT (5a): tables + indexes per the scale rules
-- Re-runnable (IF NOT EXISTS everywhere).
--
-- hr_agents: id TEXT PK = agent_states.profile (= hermes-profiles/<dir> name)
-- hr_flags: watcher + human flags (stuck|overloaded|idle|error_spike)
-- hr_actions: audit trail for every founder/hr_director action
-- ============================================================

CREATE TABLE IF NOT EXISTS hr_agents (
    id TEXT PRIMARY KEY,               -- = agent_states.profile = hermes-profiles dir name
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    role TEXT,
    specialization TEXT,
    skills TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'offboarded')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hr_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL REFERENCES hr_agents(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('stuck', 'overloaded', 'idle', 'error_spike')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT                   -- 'watcher' (auto-resolve) | founder | hr_director
);

CREATE TABLE IF NOT EXISTS hr_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor TEXT NOT NULL CHECK (actor IN ('founder', 'hr_director', 'watcher')),
    action TEXT NOT NULL,              -- pause | resume | reassign | stop | resolve | flag
    agent_id TEXT,
    task_id UUID,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- §4 indexes: every FK + every ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_hr_flags_agent ON hr_flags(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_flags_open ON hr_flags(resolved_at, severity) WHERE resolved_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_hr_actions_created ON hr_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hr_agents_dept ON hr_agents(department);

-- §4.7: RLS on (service-role API is the only writer; direct anon access denied)
ALTER TABLE hr_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_actions ENABLE ROW LEVEL SECURITY;

-- §4.4: watcher idempotency — an OPEN flag of the same type per agent is unique
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_flags_open_type ON hr_flags(agent_id, type) WHERE resolved_at IS NULL;
