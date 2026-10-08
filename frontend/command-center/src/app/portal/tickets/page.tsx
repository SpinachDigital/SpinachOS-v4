'use client';

// /portal/tickets — CLIENT SUPPORT TICKETS (Phase 9, parallel lane).
// Built against the frozen API contract (hermes-phase-9-prompt.md GOAL 1):
//   POST /api/v1/portal/tickets { subject, body, priority? } → 201 { id, status }
//   GET  /api/v1/portal/tickets → 200 [{ id, subject, status, priority, updated_at, unread }]
// No backend calls at build time. Same auth as /portal (localStorage session).

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';
const SESSION_KEY = 'spinach_portal_session';

interface Ticket {
  id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'normal' | 'high';
  updated_at: string;
  unread: boolean;
}

const STATUS_LABEL: Record<Ticket['status'], string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const STATUS_COLOR: Record<Ticket['status'], string> = {
  open: '#2563eb',
  in_progress: '#d97706',
  resolved: '#16a34a',
  closed: '#6b7280',
};

const PRIORITY_DOT: Record<Ticket['priority'], string> = {
  low: '#9ca3af',
  normal: '#2563eb',
  high: '#dc2626',
};

const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 28,
  padding: '0 10px',
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 600,
};

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

const input: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--card)',
  color: 'var(--text)',
  fontSize: 14,
};

export default function PortalTicketsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s.token && new Date(s.expires_at) > new Date()) setToken(s.token);
      }
    } catch { /* no session */ }
    setLoading(false);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_BASE}/api/v1/portal/tickets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) { setToken(null); return; }
      if (!r.ok) throw new Error('Could not load tickets.');
      setTickets(await r.json());
    } catch (e: any) {
      setError(e.message || 'Could not load tickets.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  async function createTicket() {
    if (!subject.trim() || !body.trim() || !token) return;
    setSending(true);
    setFormError(null);
    try {
      const r = await fetch(`${API_BASE}/api/v1/portal/tickets`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), body: body.trim(), priority }),
      });
      if (r.status === 429) { setFormError('Too many tickets — please wait a bit and try again.'); return; }
      if (!r.ok) throw new Error('Could not create the ticket.');
      const d = await r.json();
      setSubject(''); setBody(''); setPriority('normal'); setShowForm(false);
      window.location.href = `/portal/tickets/${d.id}`;
    } catch (e: any) {
      setFormError(e.message || 'Could not create the ticket.');
    } finally {
      setSending(false);
    }
  }

  if (!token && !loading) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 22 }}>Support tickets</h1>
        <p style={{ color: 'var(--muted-foreground)' }}>
          Sign in with your invite link first, then your tickets live here.
        </p>
        <Link href="/portal" style={{ ...btn, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          Go to sign in
        </Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>Support tickets</h1>
        <button style={btn} onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Cancel' : 'New ticket'}
        </button>
      </div>

      {showForm && (
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 20, background: 'var(--card)' }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Subject</label>
          <input style={{ ...input, marginBottom: 12 }} value={subject} onChange={(e) => setSubject(e.target.value)}
            placeholder="What do you need help with?" maxLength={120} />
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Details</label>
          <textarea style={{ ...input, minHeight: 110, padding: 12, resize: 'vertical' }} value={body}
            onChange={(e) => setBody(e.target.value)} placeholder="Describe the issue…" maxLength={4000} />
          <div style={{ display: 'flex', gap: 12, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, fontWeight: 600 }}>Priority</label>
            <select style={{ ...input, width: 'auto' }} value={priority}
              onChange={(e) => setPriority(e.target.value as any)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <button style={btn} disabled={sending || !subject.trim() || !body.trim()} onClick={createTicket}>
              {sending ? 'Sending…' : 'Open ticket'}
            </button>
          </div>
          {formError && <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8 }}>{formError}</p>}
        </section>
      )}

      {loading && <p style={{ color: 'var(--muted-foreground)' }}>Loading tickets…</p>}
      {error && <p style={{ color: '#dc2626' }}>{error}</p>}

      {!loading && !error && tickets.length === 0 && (
        <section style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>No tickets yet</p>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 14, margin: 0 }}>
            Open one above — we reply here, and you'll see it on your next visit.
          </p>
        </section>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {tickets.map((t) => (
          <Link key={t.id} href={`/portal/tickets/${t.id}`}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, minHeight: 64,
              border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px',
              background: 'var(--card)', textDecoration: 'none', color: 'var(--text)',
            }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: PRIORITY_DOT[t.priority], flexShrink: 0 }}
              title={`Priority: ${t.priority}`} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: t.unread ? 700 : 500, fontSize: 14,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.subject}
              </span>
              <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                Updated {new Date(t.updated_at).toLocaleDateString()}
              </span>
            </span>
            <span style={{ ...chip, background: `${STATUS_COLOR[t.status]}1a`, color: STATUS_COLOR[t.status] }}>
              {t.unread ? '● ' : ''}{STATUS_LABEL[t.status]}
            </span>
          </Link>
        ))}
      </div>

      <div style={{ marginTop: 20 }}>
        <Link href="/portal" style={{ ...btnGhost, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          ← Back to portal
        </Link>
      </div>
    </main>
  );
}
