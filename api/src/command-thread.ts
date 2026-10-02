/*
 * src/command-thread.ts — Sprint 3 "Think With Me" (Brainstorm v2).
 *
 * Phase 3 split (index.ts L2318-2399) — behavior now CHANGES per Sprint 3:
 *   1. 2-round cap KILLED. The agent asks genuine clarifying questions until it
 *      has what it needs. SAFETY CAP = 5 rounds, then it must stop and
 *      summarize a plan anyway (never an infinite loop, never a dead end).
 *   2. Every round is RAG-grounded: clients / packages / past campaigns are
 *      looked up BEFORE the question round (never ask what the system knows).
 *   3. Answered question slots are tracked in thread.metadata.answered — the
 *      agent is told not to repeat them.
 *   4. FAST MODE: factual questions (have we / did we / what's / kya) answer
 *      via direct DB lookup (System-1 style) — no LLM brainstorm round-trip.
 *   5. Every reply carries RAG context + thread memory + founder prefs.
 *   End of brainstorm: plan summary (Goal / Why / How / Steps / Success
 *   criteria / Risks) + EXACTLY "Plan ready - delegate karun?"
 */
import { supabase, emitFeed, sanitizeText, broadcast } from './ctx';
import { runGatewayTask } from './bridge';
import { needsBrainstorm, dispatchReply } from './command-intent';
import { executeAgentTask } from './engines/agent-execution';
import { callLaya, LAYA_DEPARTMENT_MAP } from './laya-client';
import { hybridRetrieve } from './knowledge-helper';
import { ensureWorkflowChannel, warRoomPost } from './warroom-helpers';

const BRAINSTORM_CAP = 5;

/** Founder prefs — injected into every brainstorm prompt. */
const FOUNDER_PREFS = 'The founder speaks Hinglish (Hindi-English mix) — reply in Hinglish, keep technical terms in English, be direct, no fluff, no filler.';

type Ctx = {
  thread: any;
  rounds: number;
  answered: string[];
  history: { sender: string; content: string; role?: string }[];
};

async function loadThreadContext(threadId: string): Promise<Ctx> {
  const { data: msgs } = await supabase
    .from('thread_messages')
    .select('sender, role, content, metadata')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(60);
  const history = (msgs || []).map((m: any) => ({ sender: m.sender, content: m.content, role: m.role }));
  const { data: th } = await supabase.from('command_threads').select('metadata, rounds').eq('id', threadId).single();
  const answered: string[] = (th?.metadata?.answered as string[]) || [];
  return { thread: th, rounds: th?.rounds || 0, answered, history };
}

/**
 * Sprint 3: extract which context SLOTS the agent's questions asked about.
 * Stored on the round's metadata so the next round never repeats them.
 */
function extractAskedSlots(questionText: string): string[] {
  const slots: string[] = [];
  // Sprint 3 fix: only INTERROGATIVE sentences count — a slot word inside a
  // reason/summary line ("protect 50k budget") is not a asked question. Split
  // on sentence boundaries and keep only chunks containing '?'.
  const t = questionText
    .split(/(?<=[?!.])\s+/)
    .filter(s => s.includes('?'))
    .join(' ')
    .toLowerCase();
  if (!t) return slots;
  if (/\b(budget|kharcha|spend|paisa)\b/.test(t)) slots.push('budget');
  if (/\b(client|customer)\b/.test(t)) slots.push('client');
  if (/\b(scope|range|include)\b/.test(t)) slots.push('scope');
  if (/\b(success metric|metric|kpi|measure|result)\b/.test(t)) slots.push('success_metric');
  if (/\b(timeline|deadline|duration|kab tak)\b/.test(t)) slots.push('timeline');
  if (/\b(creative|design|asset)\b/.test(t)) slots.push('creative');
  if (/\b(platform|channel)\b/.test(t)) slots.push('platform');
  if (/\b(audience|target)\b/.test(t)) slots.push('audience');
  if (/\b(region|city|location|geo)\b/.test(t)) slots.push('region');
  return slots;
}

/**
 * RAG round context: past campaigns / client facts / packages fetched BEFORE
 * the agent asks — so questions are sharp, data-backed, never generic.
 */
async function buildRoundContext(command: string): Promise<{ ragBlock: string }> {
  const parts: string[] = [];

  // clients (exact table, newest first) — names anchor the questions
  const { data: clients } = await supabase.from('clients').select('name, status, industry').order('created_at', { ascending: false }).limit(10);
  if (clients && clients.length) {
    parts.push('ACTIVE CLIENTS: ' + clients.map(c => `${c.name} (${c.industry || '?'}, ${c.status})`).join('; '));
  }

  // packages (retainer presets) — so budget questions carry real tiers
  let packages: any[] | null = null;
  try {
    const r = await supabase.from('packages').select('name, price, period').limit(6);
    packages = (r.data as any[] | null) ?? null;
  } catch { /* packages table not seeded — presets stay in code */ }
  if (packages && packages.length) {
    parts.push('PACKAGES: ' + packages.map(p => `${p.name} ₹${p.price}/${p.period || 'mo'}`).join('; '));
  }

  // RAG: past campaigns / knowledge chunks (hybridRetrieve is the ONE primitive)
  let rag: any[] = [];
  try {
    rag = await hybridRetrieve(command, null, 5);
  } catch { /* RAG down — questions still work, just less grounded */ }
  if (rag.length) {
    parts.push('PAST CAMPAIGNS / KNOWLEDGE (retrieved):\n' + rag.map(r => `- ${(r.title || r.kind || 'chunk')}: ${(r.content || '').slice(0, 220)}`).join('\n'));
  }

  return { ragBlock: parts.join('\n\n') };
}

/**
 * FAST MODE — factual questions answered via direct DB lookup (System 1).
 * Returns the answer string, or null when the question isn't factual-fast.
 */
async function fastAnswer(command: string): Promise<string | null> {
  const t = command.toLowerCase().trim();

  // "have we posted / did we publish ..." → calendar lookup
  if (/\b(have we|did we|kya humne)\b/.test(t) && /\b(post(ed)?|publish(ed)?)\b/.test(t)) {
    const { data: cal } = await supabase
      .from('marketing_content_calendar')
      .select('date, platform, status, content_text')
      .order('date', { ascending: false }).limit(5);
    if (cal && cal.length) {
      const last = cal[0];
      const published = cal.filter(c => c.status === 'published').length;
      return `Haan — calendar me ${cal.length} recent slots hain, ${published} published. Latest: ${last.date} ${last.platform} (${last.status})${last.content_text ? ' — "' + last.content_text.slice(0, 60) + '"' : ''}. Aage ka plan bataun?`;
    }
    return 'Calendar abhi khali hai — koi post scheduled/published nahi. Pehla post banau?';
  }

  // "how many clients / kitne clients" → count
  if (/\b(how many|kitne)\b/.test(t) && /\bclients?\b/.test(t)) {
    const { count } = await supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'active');
    return `${count ?? 0} active clients hain. Kis pe kaam karna hai?`;
  }

  // "what packages / pricing" → presets
  if (/\b(package|pricing)\b/.test(t) && /\b(what|kya|kaunse)\b/.test(t)) {
    const { data: pkgs } = await supabase.from('packages').select('name, price, period').limit(6);
    if (pkgs && pkgs.length) return 'Packages: ' + pkgs.map(p => `${p.name} ₹${p.price}/${p.period || 'mo'}`).join('; ') + '.';
    return 'Packages table abhi seed nahi hui — presets code me hain (4 tiers).';
  }

  return null; // not a fast-answer question
}

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
    // continuation on an ACTIVE brainstorm thread:
    //   - affirmative answer → delegatePlan (plan approved)
    //   - rounds >= CAP → the FINAL plan is already on the table → treat as yes
    //   - otherwise → fall through: the answer continues the SAME brainstorm
    if (thread.mode === 'brainstorm') {
      const affirmative = /^(yes|haan|ha|ok|okay|do it|delegate|go|kar do|de do|haan ji|theek hai|perfect)([s.,!?]+)?$/i.test(command.trim());
      if (affirmative || (thread.rounds || 0) >= BRAINSTORM_CAP) {
        return delegatePlan(thread);
      }
    }
  }

  // Sprint 3 FAST MODE: factual questions answer via direct DB lookup — no
  // brainstorm round-trip, no LLM call (System 1 style).
  const fast = await fastAnswer(command);
  if (fast) {
    await supabase.from('thread_messages').insert({
      thread_id: thread.id, sender: 'system', role: 'agent',
      content: fast, metadata: { fast_answer: true },
    });
    broadcast('thread_message', { thread_id: thread.id, sender: 'system', role: 'agent', content: fast });
    emitFeed('orchestrator', 'FAST-ANSWER', { thread: thread.id, q: command.slice(0, 60) });
    return { thread_id: thread.id, reply: fast, mode: 'fast' };
  }

  // classify
  const decision = await callLaya(command);
  const agent = decision ? (LAYA_DEPARTMENT_MAP[decision.department] || 'orchestrator') : 'orchestrator';
  // ACTIVE brainstorm thread → the user is ANSWERING round-N questions. Continue
  // the SAME brainstorm regardless of what Laya classifies the ANSWER as —
  // the answer is not a new command.
  const continuingBrainstorm = thread.mode === 'brainstorm';
  const brainstorm = continuingBrainstorm || needsBrainstorm(command, (decision as any)?.confidence);

  if (brainstorm) {
    // ---- BRAINSTORM v2: conversation, not dispatch ----
    const ctx = await loadThreadContext(thread.id);
    const rounds = ctx.rounds + 1;
    const lastRound = rounds >= BRAINSTORM_CAP;
    const brain = (decision && ['strategy', 'hr', 'finance', 'legal'].includes(decision.department)) ? 'ceo' : agent === 'orchestrator' ? 'ceo' : agent;

    // RAG-grounded round context (clients / packages / past campaigns)
    const { ragBlock } = await buildRoundContext(command);

    const memoryBlock = ctx.history.length > 1
      ? 'THREAD SO FAR:\n' + ctx.history.slice(-12).map(m => `${m.sender}: ${m.content.slice(0, 200)}`).join('\n') + '\n\n'
      : '';

    const answeredBlock = ctx.answered.length
      ? `HARD RULE — these context slots are ALREADY ANSWERED by the founder, asking about them again is a BUG: ${ctx.answered.join(', ')}. If a question would touch an answered slot, SKIP it and ask the next unanswered slot instead.\n\n`
      : '';

    const prompt = `${FOUNDER_PREFS}\n\nThe founder of Spinach Digital (an AI digital marketing agency) says: "${command}"\n\n${memoryBlock}${answeredBlock}KNOWN CONTEXT (use it — never ask what's here):\n${ragBlock || '(nothing retrieved — ask sharply)'}\n\n${lastRound
      ? `This is round ${rounds} of ${BRAINSTORM_CAP} — the SAFETY CAP. Do NOT ask more questions. Propose a concrete plan now, with these EXACT sections:\nGoal / Why / How (steps with owners) / Success criteria / Risks\nEnd with EXACTLY this line: "Plan ready — delegate karun?"`
      : `You are the chief of staff thinking WITH the founder BEFORE executing. Ask 2-4 sharp clarifying questions — each question must include a SMART DEFAULT grounded in the KNOWN CONTEXT above (e.g. "Budget — Spinach ka retainer ₹25k/mo tier theek hai, ya alag budget?"). Never ask generic questions. Max 120 words.`}`;

    const { output } = await runGatewayTask(brain, prompt);
    const reply = String(output || 'Ek clarification chahiye — kaunsa client aur kitna budget?').slice(0, 1600);

    // Sprint 3: track answered slots so questions never repeat — the founder's
    // own reply covers slots too (e.g. "budget 40k" answers budget), and the
    // agent's question text lists what it asked. Both merge into the tracker.
    // Final round (plan summary) asks nothing — skip extraction there.
    const asked = lastRound ? [] : extractAskedSlots(reply);
    const answeredFromUser = lastRound ? [] : extractAskedSlots(command);
    const answered = Array.from(new Set<string>([...ctx.answered, ...asked, ...answeredFromUser]));
    await supabase.from('command_threads').update({
      mode: 'brainstorm', rounds, metadata: { ...(thread.metadata || {}), answered },
    }).eq('id', thread.id);

    await supabase.from('thread_messages').insert({
      thread_id: thread.id, sender: brain, role: 'agent', content: reply,
      metadata: { brainstorm_round: rounds, final: lastRound, asked_slots: asked },
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
  // Sprint 8 §2 UI contract: the fast path MUST return task_id — the chat
  // surface's inline TaskCard consumes it (observed: task dispatched, reply
  // carried "Task #…", but task_id was empty → card never rendered).
  return { thread_id: thread.id, reply, mode: 'fast', task_id };
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
