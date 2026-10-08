'use client';

// /portal/tickets/[id] — TICKET THREAD (Phase 9, parallel lane).
// Contract:
//   GET  /api/v1/portal/tickets/:id → { id, subject, status, priority, messages: [{ id, author, body, created_at }] }
//   POST /api/v1/portal/tickets/:id/messages { body } → 201 { id }
// Reading the thread marks it read server-side. Closed tickets: reply box
// replaced with an honest "reopened on reply" note — the API 403s until reopen.

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const SESSION_KEY = 'spinach_portal_session';

interface Message {
  id: string;
  author: 'client' | 'founder';
  body: string;
  created_at: string;
}

interface Thread {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high';
  messages: Message[];
}

const btn: React.CSSProperties = {
  minHeight: 44,
  padding: '0 18px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};

const btnGhost: React.CSSProperties = {
  ...btn,
  background: 'transparent',
  color: 'var(--text)',
};

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
}

export default function TicketThreadPage() {
  const params = useParams();
  const id = params?.id as string;
  const [token, setToken] = useState<string | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.token && new Date(s.expires_at) > new Date()) setToken(s.token);
      }
    } catch { /* no session */ }
  }, []);

  const load = useCallback(async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/v1/portal/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) { setToken(null); return; }
      if (r.status === 404) { setError('Ticket not found.'); return; }
      if (!r.ok) throw new Error('Could not load this ticket.');
      setThread(await r.json());
    } catch (e: any) {
      setError(e.message || 'Could not load this ticket.');
    } finally {
      setLoading(false);
    }
  }, [token, id]);

  useEffect(() => { load(); }, [load]);

  async function sendReply() {
    if (!reply.trim() || !token || !id) return;
    setSending(true);
    setReplyError(null);
    try {
      const r = await fetch(`${API_BASE}/api/v1/portal/tickets/${id}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim() }),
      });
      if (r.status === 403) { setReplyError('This ticket is closed — reply here and we will reopen it.'); return; }
      if (r.status === 429) { setReplyError('Too many messages — wait a bit and try again.'); return; }
      if (!r.ok) throw new Error('Could not send your reply.');
      setReply('');
      await load();
    } catch (e: any) {
      setReplyError(e.message || 'Could not send your reply.');
    } finally {
      setSending(false);
    }
  }

  if (!token && !loading) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <p style={{ color: 'var(--muted-foreground)' }}>Sign in with your invite link to view this ticket.</p>
        <Link href="/portal" style={{ ...btn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          Go to sign in
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <Link href="/portal/tickets" style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center',
        textDecoration: 'none', marginBottom: 16 }}>
        ← All tickets
      </Link>

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Loading…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {thread && (
        <>
          <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{thread.subject}</h1>
          <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 20px' }}>
            Status: <strong>{thread.status.replace('_', ' ')}</strong> · Priority: {thread.priority}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {thread.messages.map((m) => {
              const mine = m.author === 'client';
              return (
                <div key={m.id} style={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  background: mine ? 'var(--accent)' : 'var(--card)',
                  color: mine ? '#fff' : 'var(--text)',
                  border: mine ? 'none' : '1px solid var(--border)',
                  borderRadius: 12,
                  padding: '10px 14px',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4,
                    color: mine ? 'rgba(255,255,255,0.85)' : 'var(--muted-foreground)' }}>
                    {mine ? 'You' : 'Spinach Labs'}
                  </div>
                  <div style={{ fontSize: 14, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.body}</div>
                  <div style={{ fontSize: 11, marginTop: 6,
                    color: mine ? 'rgba(255,255,255,0.7)' : 'var(--muted-foreground)' }}>
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              );
            })}
            {thread.messages.length === 0 && (
              <p style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>No messages yet.</p>
            )}
          </div>

          {thread.status === 'closed' ? (
            <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, background: 'var(--card)' }}>
              <p style={{ fontSize: 14, margin: 0, color: 'var(--muted-foreground)' }}>
                This ticket is closed. Reply below and we will reopen it.
              </p>
              <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                <input
                  style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', fontSize: 14 }}
                  value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder="Write to reopen…" maxLength={4000} />
                <button style={btn} disabled={sending || !reply.trim()} onClick={sendReply}>
                  {sending ? '…' : 'Reopen'}
                </button>
              </div>
            </section>
          ) : (
            <section>
              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  style={{ flex: 1, minHeight: 44, padding: '0 12px', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--card)',
                    color: 'var(--text)', fontSize: 14 }}
                  value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder="Write a reply…" maxLength={4000}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendReply(); }} />
                <button style={btn} disabled={sending || !reply.trim()} onClick={sendReply}>
                  {sending ? 'Sending…' : 'Reply'}
                </button>
              </div>
            </section>
          )}
          {replyError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{replyError}</p>}
        </>
      )}
    </main>
  );
}
