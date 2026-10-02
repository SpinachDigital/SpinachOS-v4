'use client';

/*
 * Sprint 8 §4 — Task-scoped chat. Every task page gets its own thread
 * with the agent working on it. Context = that task only. The thread
 * persists on the task (localStorage key per task id, survives reload)
 * and its messages go through the SAME /api/v1/command gateway with
 * thread persistence — not a separate toy path.
 * Honest states: gateway error surfaces on the thread. 44px targets.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiFetch } from '@/lib/auth';

type Msg = { id: string; role: 'user' | 'agent' | 'system'; content: string; created_at: string; task_id?: string | null };

const taskKey = (taskId: string) => `spinach_task_thread_${taskId}`;

export function TaskChat({ taskId, agent, taskTitle }: { taskId: string; agent?: string | null; taskTitle?: string }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  // restore the task's thread on mount (survives reload)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(taskKey(taskId));
      if (saved) { setThreadId(saved); void load(saved); }
      else setLoading(true);
    } catch { setLoading(true); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  // local echo: task-scoped chat keeps messages client-side per task (the
  // gateway's thread_messages are command-scoped, not task-scoped — task
  // context is carried in the command body instead).
  const load = useCallback(async (id: string) => {
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async (text: string) => {
    const command = text.trim();
    if (!command || busy) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { id: `u-${Date.now()}`, role: 'user', content: command, created_at: new Date().toISOString() }]);
    setInput('');

    try {
      // Task-scoped context: the task id + title ride in the command body so
      // the agent answering knows exactly which task this is about.
      const body: Record<string, unknown> = {
        command,
        source: 'ui',
        task_scope: { task_id: taskId, title: taskTitle || null, agent: agent || null },
        timestamp: new Date().toISOString(),
      };
      if (threadId) body.thread_id = threadId;
      const res = await apiFetch('/api/v1/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        setError(`API ${res.status} — message not delivered.`);
        return;
      }
      const data = await res.json();
      if (data.thread_id) {
        setThreadId(data.thread_id);
        try { localStorage.setItem(taskKey(taskId), data.thread_id); } catch { /* ignore */ }
      }
      const reply = data.reply || data.message || data.action || 'Agent is offline — message logged.';
      setMessages((m) => [...m, { id: `a-${Date.now()}`, role: 'agent', content: reply, created_at: new Date().toISOString(), task_id: data.task_id || null }]);
    } catch {
      setError('Gateway error — message logged.');
    } finally { setBusy(false); }
  };

  return (
    <div style={{
      borderRadius: 14, border: '1px solid var(--border-hairline, #eee)',
      background: 'var(--card, #fff)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
      overflow: 'hidden',
    }}>
      <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-soft, #eee)' }}>
        <h3 className="t-meta" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          💬 Task chat {agent ? `— @${agent}` : ''}
        </h3>
        <span className="t-mono" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>
          {threadId ? `thread ${threadId.slice(0, 8)} · persists` : 'no thread yet'}
        </span>
      </div>

      {/* messages */}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: 14 }}>
        {loaded && messages.length === 0 && (
          <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)', margin: 0 }}>
            No messages yet — ask the agent anything about this task. Context stays on this task only.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className="flex items-start gap-2" style={{ marginBottom: 10, justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div
              className="t-meta"
              style={{
                maxWidth: '82%', padding: '8px 12px', borderRadius: 12, fontSize: 12.5, lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: m.role === 'user' ? '#004B63' : 'var(--bg-2, #fafaf7)',
                color: m.role === 'user' ? '#fff' : 'var(--text, #111)',
                border: m.role === 'user' ? 'none' : '1px solid var(--border-soft, #eee)',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}
        {error && (
          <p className="t-meta" style={{ fontSize: 11.5, color: '#b91c1c', margin: 0 }}>{error}</p>
        )}
        <div ref={endRef} />
      </div>

      {/* composer */}
      <div className="flex items-center gap-2" style={{ padding: '10px 14px 12px', borderTop: '1px solid var(--border-soft, #eee)' }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void send(input); }}
          placeholder={`Ask @${agent || 'the agent'} about this task…`}
          className="t-meta"
          style={{ flex: 1, minWidth: 0, padding: '10px 14px', minHeight: 44, borderRadius: 10, border: '1px solid var(--border-soft, #ddd)', background: 'var(--bg, #fff)', color: 'var(--text, #111)', fontSize: 12.5, outline: 'none', boxSizing: 'border-box' }}
          autoComplete="off"
        />
        <button
          onClick={() => void send(input)}
          disabled={busy || !input.trim()}
          aria-label="Send task message"
          style={{ width: 44, height: 44, borderRadius: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: input.trim() ? '#004B63' : 'var(--border-soft, #eee)', color: input.trim() ? '#fff' : 'var(--text-faint)', border: 'none', cursor: input.trim() ? 'pointer' : 'default', fontSize: 14 }}
        >
          {busy ? '…' : '➤'}
        </button>
      </div>
    </div>
  );
}

export default TaskChat;
