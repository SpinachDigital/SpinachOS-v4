-- Spinach OS fix: allow dynamic (hired) agent profiles in agent_states
-- The agent_states_profile_check constraint blocks hired agents (e.g. 'engineering_f8c8d6d3')
-- causing every hire (command, Telegram /hire, /api/v1/hr/hire) to fail silently.
ALTER TABLE agent_states DROP CONSTRAINT IF EXISTS agent_states_profile_check;

-- Keep a softer guard: profile must be a core profile OR a dynamically-hired one (dept_ prefix)
ALTER TABLE agent_states ADD CONSTRAINT agent_states_profile_check
  CHECK (profile IN ('ceo', 'cto', 'orchestrator', 'research', 'social', 'engineering', 'design', 'sales', 'marketing', 'content', 'ops')
         OR profile ~ '^[a-z]+_[a-z0-9]{6,12}$');
