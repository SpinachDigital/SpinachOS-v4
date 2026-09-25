/*
 * src/command-thread.ts — Phase 3 monolith split (index.ts L2318–2399).
 * No behavior changes.
 */
import { supabase, emitFeed, sanitizeText, broadcast } from './ctx';
import { runGatewayTask } from './bridge';
import { needsBrainstorm, dispatchReply } from './command-intent';
import { executeAgentTask } from './engines/agent-execution';
import { callLaya, LAYA_DEPARTMENT_MAP } from './laya-client';
import { ensureWorkflowChannel, warRoomPost } from './warroom-helpers';
export async function handleCommandThread(command: string, threadId?: string): Promise<{ thread_id: string; reply: string; mode: string }> {
  // open or extend the thread
  let thread: any;
  if (threadId) {
    const { data } = await supabase.from('command_threads').select('*').eq('id', threadId).maybeSingle();
    thread = data;
  }
  if (!thread) {
    const { data, error } = await supabase.from('command_threads').insert({
      title: command.slice(0, 80), mode: 'fast', status: 'open', created_by: 'director',
    }).select().single();
    if (error) throw new Error(`thread create failed: ${error.message}`);
    thread = data;
    await supabase.from('thread_messages').insert({
      thread_id: thread.id, sender: 'director', role: 'user', content: command,
    });
  } else {
    await supabase.from('thread_messages').insert({
      thread_id: thread.id, sender: 'director', role: 'user', content: command,
    });
    // continuation: if the thread is in brainstorm and user says yes → delegate the plan
    if (thread.mode === 'brainstorm' && /^(yes|haan|ha|ok|do it|delegate|go)/i.test(command.trim())) {
      return delegatePlan(thread);
    }
  }

  // classify
  const decision = await callLaya(command);
  const agent = decision ? (LAYA_DEPARTMENT_MAP[decision.department] || 'orchestrator') : 'orchestrator';
  const brainstorm = needsBrainstorm(command, (decision as any)?.confidence);

  if (brainstorm) {
    // ---- BRAINSTORM: conversation, not dispatch ----
    await supabase.from('command_threads').update({ mode: 'brainstorm', rounds: (thread.rounds || 0) + 1 }).eq('id', thread.id);
    const rounds = (thread.rounds || 0) + 1;
    const brain = (decision && ['strategy', 'hr', 'finance', 'legal'].includes(decision.department)) ? 'ceo' : agent === 'orchestrator' ? 'ceo' : agent;
    const lastRound = rounds >= 2;
    const prompt = `The founder of Spinach Labs (an AI digital marketing agency) says: "${command}"
${lastRound ? 'This is the FINAL round — do not ask more questions. Propose a concrete plan with 2-4 steps and owners, then end with exactly: "Plan ready — delegate karun?"' : 'You are the chief of staff discussing this BEFORE executing. Ask 1-3 sharp clarifying questions (scope, budget, success metric, or client). Max 80 words. Hinglish ok — the founder speaks Hinglish.'}`;
    const { output } = await runGatewayTask(lastRound ? brain : brain, prompt);
    const reply = String(output || 'Ek clarification chahiye — kaunsa client aur kitna budget?').slice(0, 1200);
    await supabase.from('thread_messages').insert({
      thread_id: thread.id, sender: brain, role: 'agent', content: reply,
      metadata: { brainstorm_round: rounds, final: lastRound },
    });
    emitFeed('orchestrator', 'BRAINSTORM', { thread: thread.id, round: rounds, question: reply.slice(0, 100) });
    broadcast('thread_message', { thread_id: thread.id, sender: brain, role: 'agent', content: reply });
    return { thread_id: thread.id, reply, mode: 'brainstorm' };
  }

  // ---- FAST PATH: dispatch + visible confirmation ----
  const task_id = await executeAgentTask(agent, command, `thread:${thread.id}`);
  await supabase.from('thread_messages').insert({
    thread_id: thread.id, sender: 'system', role: 'system',
    content: dispatchReply(agent, task_id), task_id,
  });
  await supabase.from('command_threads').update({ status: 'delegated' }).eq('id', thread.id);
  const reply = dispatchReply(agent, task_id);
  broadcast('thread_message', { thread_id: thread.id, sender: 'system', role: 'system', content: reply });
  emitFeed('orchestrator', 'DISPATCHED', { thread: thread.id, agent, task_id });
  return { thread_id: thread.id, reply, mode: 'fast' };
}

/** After a "yes" to the plan: delegate the plan via the bridge, close thread. */
export async function delegatePlan(thread: any): Promise<{ thread_id: string; reply: string; mode: string }> {
  // pull the last agent message (the proposed plan)
  const { data: msgs } = await supabase.from('thread_messages')
    .select('*').eq('thread_id', thread.id).eq('role', 'agent')
    .order('created_at', { ascending: false }).limit(1);
  const plan = msgs?.[0]?.content || thread.title;
  const task_id = await executeAgentTask('orchestrator', `Execute this agreed plan (the founder approved):\n${plan}`, `thread:${thread.id}:delegate`);
  await supabase.from('thread_messages').insert({
    thread_id: thread.id, sender: 'system', role: 'system',
    content: `Plan approved — orchestrator ko de diya. Task #${task_id.slice(0, 8)}.`, task_id,
  });
  await supabase.from('command_threads').update({ status: 'delegated', mode: 'closed' }).eq('id', thread.id);
  const reply = `Plan approved — orchestrator ko de diya. Task #${task_id.slice(0, 8)}.`;
  broadcast('thread_message', { thread_id: thread.id, sender: 'system', role: 'system', content: reply });
  return { thread_id: thread.id, reply, mode: 'delegated' };
}

// POST /api/v1/command — now two-way: returns { thread_id, reply, mode }
