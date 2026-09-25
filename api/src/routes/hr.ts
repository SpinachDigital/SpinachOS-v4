/*
 * routes/hr.ts — Phase 3 monolith split (from index.ts L1442–1897).
 * No behavior changes: same paths, methods, auth, response shapes.
 * Imports come from ../ctx (supabase/JWT/emit/sanitize) + engines — added by fix-imports step.
 */

// -- imports auto-added by fix-imports (Phase 3)
import { app, AgentMessageSchema, BulkAgentActionSchema, HireAgentSchema, authMiddleware, emitAgentState, emitFeed, supabase } from '../ctx';
import { executeAgentTask } from '../engines/agent-execution';
app.get('/api/v1/agent-states', authMiddleware, async (req, res) => {
  const { data, error } = await supabase.from('agent_states').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.patch('/api/v1/agent-states/:profile', authMiddleware, async (req, res) => {
  const { data, error } = await supabase
    .from('agent_states')
    .upsert({ profile: req.params.profile, ...req.body })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  emitAgentState(req.params.profile, req.body.state, req.body.activity);
  res.json(data);
});

// ============================================
// HR DEPARTMENT & MULTI-AGENT SYSTEM
// ============================================

// In-memory agent registry (in production, store in Supabase)
const agentRegistry = new Map<string, any>();

// Initialize with department leads
const departmentLeads = {
  ceo: { id: 'ceo', name: 'CEO', department: 'executive', role: 'Chief Executive Officer', specialization: 'Strategy & Vision', skills: ['leadership', 'strategy', 'fundraising'], status: 'active' },
  cto: { id: 'cto', name: 'CTO', department: 'technology', role: 'Chief Technology Officer', specialization: 'Architecture & Engineering', skills: ['system_design', 'scalability', 'technical_leadership'], status: 'active' },
  orchestrator: { id: 'orchestrator', name: 'Orchestrator', department: 'operations', role: 'Chief Operating Officer', specialization: 'Workflow Orchestration', skills: ['project_management', 'process_optimization', 'cross_functional_coordination'], status: 'active' },
  research: { id: 'research', name: 'Head of Research', department: 'research', role: 'Research Lead', specialization: 'Market Intelligence', skills: ['market_research', 'competitive_analysis', 'trend_analysis'], status: 'active' },
  social: { id: 'social', name: 'Head of Social', department: 'marketing', role: 'Social Media Lead', specialization: 'Growth & Engagement', skills: ['social_media', 'content_strategy', 'community_building'], status: 'active' },
  hr: { id: 'hr', name: 'HR Director', department: 'hr', role: 'Human Resources Director', specialization: 'Talent Acquisition & Agent Management', skills: ['recruiting', 'agent_onboarding', 'performance_management', 'organizational_design'], status: 'active' },
  engineering: { id: 'engineering', name: 'Engineering Lead', department: 'engineering', role: 'Engineering Manager', specialization: 'Software Development', skills: ['full_stack', 'architecture', 'devops', 'code_review'], status: 'active' },
  design: { id: 'design', name: 'Design Lead', department: 'design', role: 'Design Director', specialization: 'Product & Brand Design', skills: ['ui_ux', 'brand_identity', 'design_systems', 'prototyping'], status: 'active' },
  sales: { id: 'sales', name: 'Sales Lead', department: 'sales', role: 'Sales Director', specialization: 'Revenue Generation', skills: ['b2b_sales', 'lead_qualification', 'deal_closing', 'pipeline_management'], status: 'active' },
  marketing: { id: 'marketing', name: 'Marketing Lead', department: 'marketing', role: 'Marketing Director', specialization: 'Growth Marketing', skills: ['paid_ads', 'seo', 'email_marketing', 'analytics'], status: 'active' },
  content: { id: 'content', name: 'Content Lead', department: 'marketing', role: 'Content Director', specialization: 'Content Strategy & Production', skills: ['copywriting', 'video_production', 'editorial_calendar', 'seo_content'], status: 'active' },
  ops: { id: 'ops', name: 'Operations Lead', department: 'operations', role: 'Operations Manager', specialization: 'Systems & Processes', skills: ['automation', 'monitoring', 'incident_response', 'scalability'], status: 'active' },
};

// Initialize registry
Object.values(departmentLeads).forEach(lead => {
  agentRegistry.set(lead.id, { ...lead, employees: [], created_at: new Date().toISOString() });
});

app.get('/api/v1/hr/departments', authMiddleware, async (req, res) => {
  try {
    const departments = Array.from(new Set(Object.values(departmentLeads).map(l => l.department)));
    const deptDetails = departments.map(dept => {
      const lead = Object.values(departmentLeads).find(l => l.department === dept);
      const agents = Array.from(agentRegistry.values()).filter(a => a.department === dept);
      return {
        name: dept,
        lead: lead?.id,
        lead_name: lead?.name,
        agent_count: agents.length,
        agents: agents.map(a => ({ id: a.id, name: a.name, role: a.role, status: a.status })),
      };
    });
    res.json(deptDetails);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/hr/agents', authMiddleware, async (req, res) => {
  try {
    const { department, status } = req.query;
    let agents = Array.from(agentRegistry.values());
    if (department) agents = agents.filter(a => a.department === department);
    if (status) agents = agents.filter(a => a.status === status);
    res.json(agents);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/v1/hierarchy — the org tree: leadership → HODs → benches (Part B in-app representation)
// Data: agent_states (tier/reports_to/is_dormant/bench) + live state; bench = per-dept specialist slots.
app.get('/api/v1/hierarchy', authMiddleware, async (_req, res) => {
  const { data: rows, error } = await supabase
    .from('agent_states')
    .select('profile, state, activity, tier, reports_to, display_name, is_dormant, bench, updated_at')
    .order('profile');
  if (error) return res.status(500).json({ error: `hierarchy failed: ${error.message}` });

  // Bench configs per HOD (Part B Tier 3) — static definitions, shown as on-demand slots
  const BENCHES: Record<string, string[]> = {
    designer: ['logo_specialist', 'guidelines_specialist', 'deck_specialist', 'social_creative_specialist'],
    engineer: ['frontend_specialist', 'backend_specialist', 'automation_specialist', 'qa_specialist'],
    social: ['copywriter', 'calendar_planner', 'community_specialist'],
    ads_manager: ['meta_buyer', 'google_buyer', 'creative_tester'],
    seo_specialist: ['technical_seo', 'content_seo', 'gmb_specialist', 'review_manager'],
    research: ['market_analyst', 'competitor_analyst', 'lead_researcher'],
    sales: ['sdr_outreach', 'proposal_writer', 'followup_specialist'],
  };

  const profiles = (rows || []).filter((r: any) => r.tier === 'leadership' || r.tier === 'hod');
  const leadership = profiles.filter((p: any) => p.tier === 'leadership');
  const hods = profiles.filter((p: any) => p.tier === 'hod');

  const tree = leadership.map((lead: any) => ({
    ...lead,
    children: hods
      .filter((h: any) => h.reports_to === lead.profile)
      .map((h: any) => ({
        ...h,
        bench: (BENCHES[h.profile] || []).map((slot: string) => ({
          profile: slot,
          tier: 'executive',
          status: 'available', // on-demand: loaded per task from the 279 specialist pool
          current_task: null,
        })),
      })),
  }));

  // HODs with no reports_to set (shouldn't happen post-fix, but render honestly)
  const orphans = hods.filter((h: any) => !h.reports_to || !leadership.some((l: any) => l.profile === h.reports_to));

  res.json({ leadership: tree, orphans, total_hods: hods.length, dormant: hods.filter((h: any) => h.is_dormant).map((h: any) => h.profile) });
});

app.post('/api/v1/hr/hire', authMiddleware, async (req, res) => {
  const parse = HireAgentSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    const { department, role, specialization, skills, agent_config } = parse.data;
    
    // Get department lead
    const lead = Object.values(departmentLeads).find(l => l.department === department);
    if (!lead) return res.status(404).json({ error: 'Department not found' });

    // Create new agent ID
    const agentId = `${department}_${role.toLowerCase().replace(/\s+/g, '_')}_${Date.now().toString(36)}`;
    
    const newAgent = {
      id: agentId,
      name: `${role} (${department})`,
      department,
      role,
      specialization: specialization || `Specialist in ${role}`,
      skills: skills || [],
      agent_config: agent_config || { model: 'nemotron-3-ultra', temperature: 0.7 },
      status: 'active',
      lead_id: lead.id,
      hired_at: new Date().toISOString(),
      tasks_completed: 0,
      performance_score: 100,
    };

    agentRegistry.set(agentId, { ...newAgent, employees: [] });

    // Add to lead's employees
    const leadAgent = agentRegistry.get(lead.id);
    if (leadAgent) {
      leadAgent.employees.push(agentId);
    }

    // Update agent_states table — surface errors (profile CHECK may reject dynamic ids)
    const { error: onboardErr } = await supabase
      .from('agent_states')
      .upsert({
        profile: agentId,
        state: 'idle',
        activity: 'Onboarding complete - ready for tasks',
        metadata: { department, role, lead_id: lead.id }
      });
    if (onboardErr) {
      console.error('Hire agent_states upsert failed:', onboardErr.message);
      // Registry still has the agent — return it with a warning instead of a silent partial hire
      return res.status(201).json({
        success: true,
        agent: newAgent,
        warning: `Agent registered in memory but agent_states persist failed: ${onboardErr.message}`,
      });
    }

    // Emit event
    emitFeed('hr', 'Agent hired', { agent_id: agentId, name: newAgent.name, department, role });
    emitAgentState(agentId, 'idle', 'Onboarding complete - ready for tasks');

    res.status(201).json({ success: true, agent: newAgent });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/hr/agent-message', authMiddleware, async (req, res) => {
  const parse = AgentMessageSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    const { from_agent, to_agent, message, type, payload, requires_response } = parse.data;

    // Validate agents exist
    const fromAgent = agentRegistry.get(from_agent);
    const toAgent = agentRegistry.get(to_agent);
    
    if (!fromAgent) return res.status(404).json({ error: `From agent ${from_agent} not found` });
    if (!toAgent) return res.status(404).json({ error: `To agent ${to_agent} not found` });

    // Log the message
    const messageRecord = {
      id: crypto.randomUUID(),
      from_agent,
      to_agent,
      message,
      type,
      payload,
      requires_response,
      status: 'sent',
      timestamp: new Date().toISOString(),
    };

    // Store in logs table
    await supabase.from('logs').insert({
      profile: from_agent,
      agent: from_agent,
      action: `agent_message_${type}`,
      input_json: { to_agent, message, payload },
      output_json: { status: 'sent', requires_response },
      status: 'success',
      metadata: { message_id: messageRecord.id },
    });

    // Update sender state
    emitAgentState(from_agent, 'speaking', `Sending ${type} to ${to_agent}: ${message.slice(0, 50)}`);

    // Update receiver state
    emitAgentState(to_agent, 'thinking', `Received ${type} from ${from_agent}: ${message.slice(0, 50)}`);

    // If it's a task, create a task record
    if (type === 'task') {
      // BOT MODE BRIDGE (REVIEW.md promise): @mention → HOD profile invocation.
      // The message isn't just logged — it dispatches to the receiving agent's REAL
      // brain via the execution bridge (profile/gateway by task kind), WS events flow.
      const task_id = await executeAgentTask(to_agent, message, `agent-message:${messageRecord.id}`);
      await supabase.from('tasks').insert({
        title: message.slice(0, 100),
        description: message,
        assigned_to: to_agent,
        status: 'running',
        metadata: { from_agent, payload, requires_response, message_id: messageRecord.id, bridge_task_id: task_id },
      });
    }

    res.json({ success: true, message: messageRecord, to_agent: toAgent.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/hr/agent-messages', authMiddleware, async (req, res) => {
  try {
    const { agent, limit } = req.query;
    let query = supabase.from('logs').select('*').eq('action', 'agent_message_task');
    if (agent) query = query.or(`profile.eq.${agent},metadata->>to_agent.eq.${agent}`);
    if (limit) query = query.limit(parseInt(limit as string));
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/hr/bulk-action', authMiddleware, async (req, res) => {
  const parse = BulkAgentActionSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.format() });

  try {
    const { department, agents: agentIds, action } = parse.data;
    let targetAgents = Array.from(agentRegistry.values());
    
    if (department) targetAgents = targetAgents.filter(a => a.department === department);
    if (agentIds && agentIds.length > 0) targetAgents = targetAgents.filter(a => agentIds.includes(a.id));

    const results = [];
    for (const agent of targetAgents) {
      let newState = agent.status;
      let activity = agent.activity || 'Idle';
      
      switch (action) {
        case 'start':
          newState = 'active';
          activity = 'Started by bulk action';
          break;
        case 'stop':
          newState = 'paused';
          activity = 'Stopped by bulk action';
          break;
        case 'pause':
          newState = 'paused';
          activity = 'Paused by bulk action';
          break;
        case 'resume':
          newState = 'active';
          activity = 'Resumed by bulk action';
          break;
        case 'status':
          // Just return current status
          break;
      }

      agent.status = newState;
      agentRegistry.set(agent.id, agent);

      // Update agent_states table
      await supabase.from('agent_states').upsert({ 
        profile: agent.id, 
        state: action === 'stop' || action === 'pause' ? 'idle' : 'working', 
        activity 
      });

      emitAgentState(agent.id, action === 'stop' || action === 'pause' ? 'idle' : 'working', activity);
      results.push({ id: agent.id, name: agent.name, status: newState, activity });
    }

    res.json({ success: true, action, agents_affected: results.length, results });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/hr/agent-task', authMiddleware, async (req, res) => {
  try {
    const { agent_id, task_title, task_description, priority = 0, dependencies = [] } = req.body;
    
    const agent = agentRegistry.get(agent_id);
    if (!agent) return res.status(404).json({ error: `Agent ${agent_id} not found` });

    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: task_title,
        description: task_description,
        assigned_to: agent_id,
        status: 'running',
        priority,
        dependencies,
        metadata: { assigned_by: 'director', department: agent.department },
      })
      .select()
      .single();
    
    if (error) throw error;

    // Update agent state
    await supabase.from('agent_states').upsert({ 
      profile: agent_id, 
      state: 'working', 
      activity: `Working on: ${task_title}`,
      current_task_id: task.id 
    });
    emitAgentState(agent_id, 'working', `Working on: ${task_title}`);

    // Update agent performance
    agent.tasks_completed = (agent.tasks_completed || 0) + 1;
    agentRegistry.set(agent_id, agent);

    emitFeed(agent.department === 'executive' ? 'ceo' : agent.department, 'Task assigned', { agent_id, task_id: task.id, title: task_title });

    res.json({ success: true, task, agent: agent.name });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/v1/hr/org-chart', authMiddleware, async (req, res) => {
  try {
    const orgChart = {
      executive: {
        ceo: { ...departmentLeads.ceo, reports: [] },
      },
      technology: {
        cto: { ...departmentLeads.cto, reports: [] },
      },
      operations: {
        orchestrator: { ...departmentLeads.orchestrator, reports: [] },
        ops: { ...departmentLeads.ops, reports: [] },
      },
      research: {
        research: { ...departmentLeads.research, reports: [] },
      },
      marketing: {
        social: { ...departmentLeads.social, reports: [] },
        marketing: { ...departmentLeads.marketing, reports: [] },
        content: { ...departmentLeads.content, reports: [] },
      },
      engineering: {
        engineering: { ...departmentLeads.engineering, reports: [] },
      },
      design: {
        design: { ...departmentLeads.design, reports: [] },
      },
      sales: {
        sales: { ...departmentLeads.sales, reports: [] },
      },
      hr: {
        hr: { ...departmentLeads.hr, reports: [] },
      },
    };

    // Add hired employees to their leads
    agentRegistry.forEach(agent => {
      if (agent.lead_id && orgChart[agent.department]?.[agent.lead_id]) {
        orgChart[agent.department][agent.lead_id].reports.push({
          id: agent.id,
          name: agent.name,
          role: agent.role,
          status: agent.status,
        });
      }
    });

    res.json(orgChart);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/v1/hr/performance-review', authMiddleware, async (req, res) => {
  try {
    const { agent_id, score, feedback } = req.body;
    
    const agent = agentRegistry.get(agent_id);
    if (!agent) return res.status(404).json({ error: `Agent ${agent_id} not found` });

    agent.performance_score = score;
    agent.last_review = new Date().toISOString();
    agent.last_feedback = feedback;
    agentRegistry.set(agent_id, agent);

    // Log review
    await supabase.from('logs').insert({
      profile: 'hr',
      agent: 'hr',
      action: 'performance_review',
      input_json: { agent_id, score, feedback },
      output_json: { agent_name: agent.name, new_score: score },
      status: 'success',
    });

    emitFeed('hr', 'Performance review completed', { agent_id, score, agent_name: agent.name });
    emitAgentState(agent_id, 'idle', `Performance review completed - Score: ${score}`);

    res.json({ success: true, agent_id, new_score: score });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ============================================
// DAILY OPERATIONS ENGINE
// ============================================
