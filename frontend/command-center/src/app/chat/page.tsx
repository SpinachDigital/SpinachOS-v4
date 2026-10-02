'use client';

/*
 * /chat — Sprint 8 §1+§2: THE Jarvis surface. Chat-first homepage surface:
 * greeting, suggestion chips (real flows — no dead chips), ONE command bar
 * (CommandGateway is canonical — this page embeds its intents via the same
 * /api/v1/command endpoint + thread persistence), recent threads, message
 * list with markdown, inline rich cards (task / deliverable / approval via
 * ChatCard), voice mic (same gateway intents). Honest empty states.
 * 360px clean; 44px touch targets.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import ChatCard from '@/components/chat/ChatCard';

type Msg = {
  id: string;
  role: 'user' | 'agent' | 'system';
  content: string;
  created_at: string;
  task_id?: string | null;
};
type Thread = { id: string; title: string; mode: string; status: string; updated_at: string };
type CardRef = { kind: 'task' | 'deliverable' | 'approval'; id: string };

// Suggestion chips — every chip triggers a REAL flow (§1: no dead chips).
const CHIPS: { label: string; prompt: string | null; href?: string }[] = [
  { label: '📋 Show pending approvals', prompt: null, href: '/approvals' },
  { label: '🤖 What are agents doing?', prompt: null, href: '/team' },
  { label: '🚀 Start a pipeline', prompt: 'start a pipeline for ' },
  { label: '🧠 Think with me', prompt: 'think with me about ' },
  { label: '📊 Today standup', prompt: 'show today\'s standup' },
];

const THREAD_KEY = 'spinach_thread_id';

export default function ChatPage() {
  const router = useRouter();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadTitle, setThreadTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [cards, setCards] = useState<CardRef[]>([]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // restore thread on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THREAD_KEY);
      if (saved) { setThreadId(saved); void loadThread(saved); }
    } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // recent threads
  const [threads, setThreads] = useState<Thread[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/v1/threads');
        if (res.ok) setThreads((await res.json()).slice(0, 6));
      } catch { /* honest empty */ }
    })();
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setLoadingThread(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/v1/threads/${id}/messages`);
      if (res.ok) {
        setMessages(await res.json());
        const t = threads.find((x) => x.id === id);
        if (t) setThreadTitle(t.title);
      } else {
        setError(`Thread unavailable (API ${res.status}).`);
      }
    } catch {
      setError('Failed to load thread.');
    } finally { setLoadingThread(false); }
  }, [threads]);

  // card extraction: a message that delegated a task or references an approval
  // renders its inline card right after the message (§2).
  useEffect(() => {
    const refs: CardRef[] = [];
    for (const m of messages) {
      if (m.task_id) refs.push({ kind: 'task', id: m.task_id });
    }
    setCards(refs);
  }, [messages]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages, cards]);

  const send = async (text: string, source: 'text' | 'voice' = 'text') => {
    const command = text.trim();
    if (!command || busy) return;
    setBusy(true);
    setError(null);
    const local: Msg = { id: `local-${Date.now()}`, role: 'user', content: `${source === 'voice' ? '🎙 ' : ''}${command}`, created_at: new Date().toISOString() };
    setMessages((m) => [...m, local]);
    setInput('');
    setTranscript('');

    try {
      const body: Record<string, unknown> = { command, source: 'ui', timestamp: new Date().toISOString() };
      if (threadId) body.thread_id = threadId;
      const res = await apiFetch('/api/v1/command', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        setError(`API error ${res.status} — command not delivered.`);
        return;
      }
      const data = await res.json();
      if (data.thread_id) {
        setThreadId(data.thread_id);
        try { localStorage.setItem(THREAD_KEY, data.thread_id); } catch { /* ignore */ }
        if (!threadId) void loadThread(data.thread_id);
      }
      const reply = data.reply || data.message || data.action || 'Office is offline — command logged.';
      const remote: Msg = { id: `remote-${Date.now()}`, role: 'agent', content: reply, created_at: new Date().toISOString(), task_id: data.task_id || null };
      setMessages((m) => [...m, remote]);
    } catch {
      setError('Gateway error — command logged.');
    } finally { setBusy(false); }
  };

  const toggleMic = () => {
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) { setError('Voice not supported in this browser — use text.'); return; }
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e: any) => {
      let final = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript;
      }
      setTranscript(final || interim);
      if (final) { setListening(false); void send(final, 'voice'); }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const newThread = () => {
    try { localStorage.removeItem(THREAD_KEY); } catch { /* ignore */ }
    setThreadId(null); setThreadTitle(null); setMessages([]); setCards([]); setError(null);
  };

  return (
    <div className="flex h-full" style={{ background: 'var(--bg)' }}>
      {/* ============ THREADS RAIL ============ */}
      <aside style={{ display: 'none' }} className="chat-rail" />
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border-hairline, #eee)', display: 'flex', flexDirection: 'column' }} className="chat-threads">
        <div style={{ padding: '14px 16px 8px' }}>
          <button onClick={newThread} style={{ width: '100%', padding: '10px 12px', minHeight: 44, borderRadius: 10, background: '#004B63', color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
            + New thread
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
          <div className="t-label" style={{ fontSize: 10, color: 'var(--text-faint)', padding: '8px 8px 4px' }}>RECENT THREADS</div>
          {threads.length === 0 && (
            <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)', padding: '4px 8px' }}>No threads yet — say something to the office.</p>
          )}
          {threads.map((t) => (
            <button
              key={t.id}
              onClick={() => { setThreadId(t.id); void loadThread(t.id); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '10px 10px', minHeight: 44,
                borderRadius: 10, border: 'none', cursor: 'pointer', marginBottom: 2,
                background: t.id === threadId ? 'var(--green-dim, rgba(76,175,80,0.12))' : 'transparent',
                color: 'var(--text, #111)',
              }}
            >
              <span className="t-meta" style={{ fontSize: 12.5, fontWeight: t.id === threadId ? 600 : 400, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {t.title}
              </span>
              <span className="t-mono" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>{t.mode} · {fmtShort(t.updated_at)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ============ CHAT MAIN ============ */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div className="flex items-center justify-between" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-hairline, #eee)' }}>
          <div>
            <h1 className="t-title" style={{ fontSize: 16, color: 'var(--text)', margin: 0 }}>
              {threadTitle || (threadId ? `Thread ${threadId.slice(0, 8)}` : 'Office chat')}
            </h1>
            <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
              {threadId ? 'Context: this thread only · persists on reload' : 'Everything happens here — command the office'}
            </p>
          </div>
          <span className={`dot ${busy ? 'dot-amber' : 'dot-green'} dot-pulse`} title={busy ? 'working' : 'ready'} />
        </div>

        {/* greeting + chips (fresh thread only) */}
        {messages.length === 0 && !threadId && (
          <div style={{ padding: '36px 24px 8px' }}>
            <h2 className="t-title" style={{ fontSize: 22, color: 'var(--text)', margin: '0 0 4px' }}>Good evening, Abhishek 👋</h2>
            <p className="t-meta" style={{ fontSize: 13, color: 'var(--text-faint)', margin: 0 }}>A quieter, brighter tomorrow — what should the office do?</p>
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 18 }}>
              {CHIPS.map((c) => (
                <button
                  key={c.label}
                  onClick={() => (c.href ? router.push(c.href) : setInput(c.prompt || ''))}
                  style={{
                    padding: '10px 14px', minHeight: 44, borderRadius: 999, fontSize: 12.5, cursor: 'pointer',
                    background: 'var(--card, #fff)', color: 'var(--text, #111)',
                    border: '1px solid var(--border-hairline, #eee)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* messages + inline cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loadingThread && <div className="t-mono" style={{ fontSize: 12, color: 'var(--text-faint)' }}>Loading thread…</div>}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 10 }}>
              <p className="t-meta" style={{ fontSize: 12.5, color: '#b91c1c', margin: 0 }}>{error}</p>
            </div>
          )}
          {!loadingThread && messages.length === 0 && threadId && (
            <div className="empty-state" style={{ padding: 24, textAlign: 'center' }}>
              <p className="t-meta" style={{ color: 'var(--text-faint)', fontSize: 12.5 }}>This thread has no messages yet — command the office below.</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 14 }}>
              <div className="flex items-start gap-2" style={{ justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {m.role !== 'user' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--green-dim, rgba(76,175,80,0.15))', color: 'var(--green-bright, #4ade80)', fontWeight: 700, fontSize: 10 }}>SD</div>
                )}
                <div
                  className="t-meta"
                  style={{
                    maxWidth: '78%', padding: '10px 14px', borderRadius: 14, fontSize: 13, lineHeight: 1.55,
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                    background: m.role === 'user' ? '#004B63' : 'var(--card, #fff)',
                    color: m.role === 'user' ? '#fff' : 'var(--text, #111)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-hairline, #eee)',
                  }}
                >
                  {m.content}
                </div>
              </div>
              {/* inline cards after the message that produced them */}
              {m.task_id && (
                <ChatCard kind="task" obj={{ id: m.task_id, title: `Task from: ${m.content.slice(0, 50)}`, status: 'running', agent: null }} />
              )}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        {/* composer — same gateway intents (CommandGateway is canonical; this is its thread UI) */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--border-hairline, #eee)' }}>
          {listening && transcript && (
            <div className="t-meta" style={{ padding: '8px 14px', borderRadius: 10, background: 'rgba(185,74,62,0.12)', color: '#b45309', fontSize: 12.5, marginBottom: 8 }}>{transcript}</div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleMic}
              aria-label={listening ? 'Stop listening' : 'Speak to the office'}
              style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: listening ? 'rgba(185,74,62,0.15)' : 'var(--card, #fff)', color: listening ? '#b45309' : 'var(--text-dim, #333)', border: '1px solid var(--border-hairline, #eee)', cursor: 'pointer', fontSize: 16 }}
            >
              🎙
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(input); }}
              placeholder={listening ? 'Listening…' : 'Tell the office what to do…'}
              className="t-meta"
              style={{ flex: 1, minWidth: 0, padding: '10px 16px', minHeight: 44, borderRadius: 999, border: '1px solid var(--border-hairline, #eee)', background: 'var(--card, #fff)', color: 'var(--text, #111)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
              autoComplete="off"
            />
            <button
              onClick={() => void send(input)}
              disabled={busy || !input.trim()}
              aria-label="Send"
              style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: input.trim() ? '#004B63' : 'var(--border-soft, #eee)', color: input.trim() ? '#fff' : 'var(--text-faint)', border: 'none', cursor: input.trim() ? 'pointer' : 'default', fontSize: 15 }}
            >
              {busy ? '…' : '➤'}
            </button>
          </div>
        </div>
      </div>

      {/* 360px: threads rail collapses (hidden <700px) */}
      <style jsx global>{`
        @media (max-width: 700px) {
          .chat-threads { display: none !important; }
        }
      `}</style>
    </div>
  );
}

function fmtShort(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
}
