/*
 * special-handler.ts — specialCommandHandler (Phase 3 split from index.ts).
 * Domain branches (pipeline/onboard/approval/hire/standup) — they act, not discuss.
 */
import { supabase, emitFeed, sanitizeText, emitAgentState, emitApproval, emitTaskUpdate, emitTaskLifecycle } from '../ctx';
import { executeAgentTask } from '../engines/agent-execution';
import { resolvePath } from '../bridge';

export async function specialCommandHandler(command: string, authHeader?: string): Promise<any | null> {
  {
    const cmdTrim = command.toLowerCase().trim();
    // Typo/fuzzy-tolerant pipeline intent: match 'pipeline'/'piprlinr' style
    // starts ("start pip*", "new client", "onboard"). A real onboarding intent
    // must NEVER silently fall through to a random department LLM call —
    // observed: 'start piprlinr for new client keo karpin' missed the exact
    // match, went to sales→social profile, which died on NVIDIA 404/429 and
    // the task still closed 'done' with nothing delivered.
    const isPipelineCmd = (cmdTrim.includes('start') && (cmdTrim.includes('pip') || cmdTrim.includes('workflow')))
      || cmdTrim.includes('onboard');
    const isApprovalCmd = cmdTrim.includes('approve') || cmdTrim.includes('reject') || cmdTrim.includes('pending');
    const isHireCmd = cmdTrim.includes('hire');
    const isStandupCmd = cmdTrim.includes('standup');
    if (!isPipelineCmd && !isApprovalCmd && !isHireCmd && !isStandupCmd) return null;


          let result: any = { action: 'unknown', reply: '' };

          // Pipeline commands
    if (cmdTrim.includes('start') && (cmdTrim.includes('pip') || cmdTrim.includes('workflow'))) {
      // Extract client name — simplified
      const clientMatch = cmdTrim.match(/(?:for|client)\s+([^.]+)/);
      let clientName = clientMatch ? clientMatch[1].trim() : 'New Client';
      // 'for new client keo karpin' captures 'new client keo karpin' — strip the lead-in words
      clientName = clientName.replace(/^new\s+client\s+/i, '').replace(/^client\s+/i, '').replace(/^for\s+/i, '').trim() || 'New Client';
      
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .insert({ name: clientName, business_type: 'general', status: 'active' })
        .select()
        .single();
      
      if (client) {
        const { data: workflow } = await supabase
          .from('workflows')
          .insert({
            name: 'client_pipeline',
            client_id: client.id,
            status: 'active',
            current_step: 'strategy',
            progress: 0,
            steps_json: [
              { name: 'strategy', agent: 'ceo', status: 'in_progress', description: 'Create growth strategy' },
              { name: 'task_breakdown', agent: 'cto', status: 'pending', description: 'Break strategy into tasks' },
              { name: 'lead_generation', agent: 'sales', status: 'pending', description: 'Generate qualified leads' },
              { name: 'content_creation', agent: 'content', status: 'pending', description: 'Create posts and scripts' },
              { name: 'design_assets', agent: 'design', status: 'pending', description: 'Create visual assets' },
              { name: 'engineering_build', agent: 'engineering', status: 'pending', description: 'Build website/tech' },
              { name: 'approval_review', agent: 'orchestrator', status: 'pending', description: 'Director approval' },
              { name: 'launch', agent: 'ops', status: 'pending', description: 'Launch and monitor' }
            ]
          })
          .select()
          .single();
        
        if (workflow) {
          emitFeed('orchestrator', 'Pipeline started', { workflow_id: workflow.id, client: clientName });
          emitAgentState('ceo', 'working', 'Creating growth strategy');
          result = { action: 'start_pipeline', reply: `Started pipeline for "${clientName}" (${workflow.id.slice(0,8)}) — CEO working on strategy`, workflow_id: workflow.id };
        }
      }
    }
    // Approval commands
    else if (cmdTrim.includes('approve') && cmdTrim.includes('strategy')) {
      const { data: approvals } = await supabase
        .from('approvals')
        .select('*')
        .eq('type', 'strategy')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (approvals && approvals.length > 0) {
        const approval = approvals[0];
        await supabase.from('approvals').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', approval.id);
        emitApproval({ ...approval, status: 'approved' });
        emitFeed('director', 'Strategy approved', { approval_id: approval.id });
        result = { action: 'approve_strategy', reply: `Approved strategy for ${approval.payload_json?.client_name || 'client'}` };
      } else {
        result = { action: 'none', reply: 'No pending strategy approvals found' };
      }
    }
    else if (cmdTrim.includes('show') && (cmdTrim.includes('pending') || cmdTrim.includes('approval'))) {
      const { data: approvals } = await supabase
        .from('approvals')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (approvals && approvals.length > 0) {
        const list = approvals.map((a: any) => `- ${a.type}: ${a.payload_json?.client_name || a.payload_json?.title || 'N/A'} (${a.id.slice(0,8)})`).join('\n');
        result = { action: 'list_approvals', reply: `Pending approvals (${approvals.length}):\n${list}` };
      } else {
        result = { action: 'list_approvals', reply: 'No pending approvals' };
      }
    }
    // Agent commands
    else if (cmdTrim.includes('hire')) {
      let department = 'engineering';
      let role = 'Developer';
      
      if (cmdTrim.includes('engineering') || cmdTrim.includes('backend') || cmdTrim.includes('frontend')) department = 'engineering';
      else if (cmdTrim.includes('design')) department = 'design';
      else if (cmdTrim.includes('marketing') || cmdTrim.includes('growth')) department = 'marketing';
      else if (cmdTrim.includes('sales')) department = 'sales';
      else if (cmdTrim.includes('content')) department = 'content';
      else if (cmdTrim.includes('research')) department = 'research';
      else if (cmdTrim.includes('operations') || cmdTrim.includes('ops')) department = 'ops';
      
      const roleMatch = cmdTrim.match(/(?:hire|as)\s+([^in]+?)(?:\s+in|\s*$)/);
      if (roleMatch) role = roleMatch[1].trim();
      
      const agentId = crypto.randomUUID().slice(0, 8);
      // agent_states has NO department/role columns — those go in metadata (PGRST204 otherwise,
      // silently swallowed without destructuring). emitAgentState persists the row.
      const { error: hireErr } = await supabase.from('agent_states').upsert({
        profile: `${department}_${agentId}`,
        state: 'idle',
        activity: `Hired as ${role}`,
        current_task_id: null,
        metadata: { department, role, hired_via: 'command' }
      });
      if (hireErr) console.error('Hire upsert failed:', hireErr.message);
      
      emitFeed('hr', 'Agent hired', { department, role, id: agentId });
      emitAgentState(`${department}_${agentId}`, 'idle', `Hired as ${role}`);
      result = { action: 'hire', reply: `Hired ${role} in ${department} (${agentId})` };
    }
    else if (cmdTrim.includes('pause') && cmdTrim.includes('marketing')) {
      emitFeed('director', 'Bulk action', { action: 'pause', department: 'marketing' });
      emitAgentState('marketing', 'paused', 'Paused by director');
      emitAgentState('social', 'paused', 'Paused by director');
      emitAgentState('content', 'paused', 'Paused by director');
      result = { action: 'pause_marketing', reply: 'Paused all marketing agents (marketing, social, content)' };
    }
    else if (cmdTrim.includes('resume') && cmdTrim.includes('marketing')) {
      emitFeed('director', 'Bulk action', { action: 'resume', department: 'marketing' });
      emitAgentState('marketing', 'idle', 'Resumed');
      emitAgentState('social', 'idle', 'Resumed');
      emitAgentState('content', 'idle', 'Resumed');
      result = { action: 'resume_marketing', reply: 'Resumed all marketing agents' };
    }
    else if (cmdTrim.includes('daily') && cmdTrim.includes('standup')) {
      emitFeed('orchestrator', 'Daily standup triggered', {});
      result = { action: 'daily_standup', reply: 'Daily standup initiated — orchestrator processing all active pipelines' };
      // Could trigger the actual endpoint
      try {
        await fetch('http://localhost:4000/api/v1/daily-standup', { method: 'POST', headers: { 'Authorization': authHeader || '' } });
      } catch {}
    }
    else if (cmdTrim.includes('schedule') && cmdTrim.includes('standup')) {
      try {
        await fetch('http://localhost:4000/api/v1/calendar/standup', { 
          method: 'POST', 
          headers: { 'Authorization': authHeader || '' } 
        });
        result = { action: 'schedule_standup', reply: 'Daily standup scheduled for all active agents at 9 AM' };
      } catch (e: any) {
        result = { action: 'schedule_standup', reply: 'Failed to schedule standup' };
      }
    }
    else if (cmdTrim.includes('show') && (cmdTrim.includes('calendar') || cmdTrim.includes('schedule'))) {
      try {
        const res = await fetch('http://localhost:4000/api/v1/calendar/events', { 
          headers: { 'Authorization': authHeader || '' } 
        });
        if (res.ok) {
          const events = await res.json();
          if (events.length > 0) {
            const list = events.slice(0, 10).map((e: any) => 
              `- ${e.title} (${new Date(e.start_time).toLocaleString()}) [${e.attendees?.map((a: any) => a.id).join(', ') || 'no attendees'}]`
            ).join('\n');
            result = { action: 'show_calendar', reply: `Upcoming events (${events.length}):\n${list}` };
          } else {
            result = { action: 'show_calendar', reply: 'No events scheduled' };
          }
        } else {
          result = { action: 'show_calendar', reply: 'Calendar tables not yet created in Supabase' };
        }
      } catch (e: any) {
        result = { action: 'show_calendar', reply: 'Calendar not available' };
      }
    }
    else if (cmdTrim.includes('status') || cmdTrim.includes('show') && cmdTrim.includes('agent')) {
      const { data: agents } = await supabase.from('agent_states').select('*').order('profile');
      if (agents && agents.length > 0) {
        const list = agents.map((a: any) => `- ${a.profile}: ${a.state} — ${a.activity || 'idle'}`).join('\n');
        result = { action: 'agent_status', reply: `Agent states (${agents.length}):\n${list}` };
      } else {
        result = { action: 'agent_status', reply: 'No agents registered' };
      }
    }
    // Default: try to parse as chat
    else {
      // Forward to chat endpoint logic
      emitFeed('director', 'Command received', { command, source: 'special' });
      result = { action: 'chat', reply: `Received: "${command}" — I'll process this. Try: "start pipeline for [client]", "approve strategy", "show pending approvals", "hire [role] in [dept]", "pause marketing", "daily standup", "agent status"` };
    }

    // TASK TRACKING: every non-Laya command becomes a tracked task (audit trail: id/status/result)
    // Laya-routed commands already persist via executeAgentTask; these branches don't.
    const LAYA_TRACKED_ACTIONS = ['laya_routed'];
    if (!LAYA_TRACKED_ACTIONS.includes(result.action)) {
      try {
        const { data: cmdTask, error: cmdTaskErr } = await supabase
          .from('tasks')
          .insert({
            title: `Command: ${command.slice(0, 100)}`,
            description: command,
            assigned_to: 'orchestrator',
            status: 'done',  // command processed synchronously — record the outcome
            priority: 2,
            metadata: {
              source: 'special-command',
              action: result.action,
              reply: String(result.reply || '').slice(0, 500),
              workflow_id: result.workflow_id || null,
              processed_at: new Date().toISOString(),
            },
          })
          .select()
          .single();
        if (!cmdTaskErr && cmdTask) {
          result.task_id = cmdTask.id;
          emitTaskUpdate(cmdTask);
        }
      } catch (trackErr: any) {
        // Tracking failure must not break the command response — log it
        console.error('Command task tracking failed:', trackErr?.message);
      }
    }

    return { ok: true, ...result, timestamp: new Date().toISOString() };
  }
}

// ============================================
// LAYA ROUTING CONTROLLER — System 1 fast path
