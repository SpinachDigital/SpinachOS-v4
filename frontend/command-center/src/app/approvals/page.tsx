'use client';

// Approvals — THE INBOX. N3: keyboard-first triage surface.
// - N3.14: single-key triage (j/k/a/r/s/o/x) via useTriageKeys
// - N3.15: split inbox — Decide / Watching / Done (?tab= shareable)
// - N3.16: optimistic approve/reject/snooze with visible rollback
// - N3.18: one-time shortcut callout
// - N3.20-frontend: fresh facts render inside the expanded card (ApprovalQueue)
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';
import { useTriageKeys } from '@/hooks/useTriageKeys';
import { registerPaletteActions } from '@/components/shell/CommandPalette';
import type { FeedEntry } from '@/lib/office/wsStore';

const ApprovalQueue = dynamic(() => import('@/components/ApprovalQueue').then(m => ({ default: m.ApprovalQueue })), {
  ssr: false,
  loading: () => <div className="t-meta" style={{ color: 'var(--text-faint)' }}>Loading approvals…</div>,
});

export interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  platform?: string;
  status: string;
  client_id?: string;
  payload_json?: any;
  created_at: string;
  approved_by?: string;
  reviewed_at?: string;
  snoozed_until?: string | null;
  risk_tier?: string;
  triage_score?: number;
  triage_reasons?: string[];
  blocking?: boolean;
}

type Tab = 'decide' | 'watching' | 'done';

const TABS: { id: Tab; label: string }[] = [
  { id: 'decide', label: 'Decide' },
  { id: 'watching', label: 'Watching' },
  { id: 'done', label: 'Done' },
];

function isSnoozed(a: ApprovalItem, localSnoozed: Record<string, string>): boolean {
  const until = localSnoozed[a.id] || a.snoozed_until;
  return !!until && new Date(until) > new Date();
}

function decidedToday(a: ApprovalItem): boolean {
  if (a.status !== 'approved' && a.status !== 'rejected') return false;
  if (!a.reviewed_at) return false;
  return new Date(a.reviewed_at).toDateString() === new Date().toDateString();
}

const CALLOUT_KEY = 'spinach_n3_callout_seen';

export default function ApprovalsPage() {
  const { connected, everConnected, feed } = useWebSocket();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() => {
    if (typeof window === 'undefined') return 'decide';
    const m = window.location.search.match(/[?&]tab=(decide|watching|done)/);
    return (m?.[1] as Tab) || 'decide';
  });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reasonForId, setReasonForId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // N3.16 optimistic overlays
  const [decidedLocal, setDecidedLocal] = useState<Record<string, { action: 'approved' | 'rejected'; at: number }>>({});
  const [snoozedLocal, setSnoozedLocal] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});
  const [showCallout, setShowCallout] = useState(false);
  const inFlight = useRef<Set<string>>(new Set());

  const fetchApprovals = useCallback(async () => {
    try {
      const res = await apiFetch('/api/v1/approvals?triage=1&limit=500');
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
        setLoadError(null);
        // Clear optimistic overlays the server now reflects.
        setDecidedLocal(prev => {
          const next = { ...prev };
          for (const a of data as ApprovalItem[]) {
            if (a.status !== 'pending' && next[a.id]) delete next[a.id];
          }
          return next;
        });
        setSnoozedLocal(prev => {
          const next = { ...prev };
          for (const a of data as ApprovalItem[]) {
            if (a.snoozed_until && next[a.id]) delete next[a.id];
          }
          return next;
        });
      } else {
        setLoadError(`Couldn't load approvals (${res.status})`);
      }
    } catch (e) {
      console.error('Failed to fetch approvals:', e);
      setLoadError("Couldn't reach the API");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  // N3.22 deep-link: /approvals?focus=<id> (from nudges) focuses + scrolls
  // to the card. Runs after the list loads.
  useEffect(() => {
    if (loading || approvals.length === 0) return;
    try {
      const id = new URL(window.location.href).searchParams.get('focus');
      if (!id) return;
      const exists = approvals.some(a => a.id === id && a.status === 'pending');
      if (!exists) return;
      if (tab !== 'decide') switchTab('decide');
      setFocusedId(id);
      // Clear the param so refresh doesn't re-jump.
      const url = new URL(window.location.href);
      url.searchParams.delete('focus');
      window.history.replaceState(null, '', url.toString());
      requestAnimationFrame(() => {
        document.querySelector(`[data-approval-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, approvals]);

  useEffect(() => {
    const latest = [...feed].reverse().find(f => f.action === 'created' || f.action === 'approved' || f.action === 'rejected');
    if (latest) fetchApprovals();
  }, [feed, fetchApprovals]);

  useEffect(() => {
    try {
      if (!localStorage.getItem(CALLOUT_KEY)) setShowCallout(true);
    } catch { /* noop */ }
  }, []);

  const dismissCallout = () => {
    setShowCallout(false);
    try { localStorage.setItem(CALLOUT_KEY, '1'); } catch { /* noop */ }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setFocusedId(null);
    setExpandedId(null);
    setReasonForId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    } catch { /* noop */ }
  };

  // ---- tab lists (one fetch, one-number law) ----
  const decideList = useMemo(
    () => approvals.filter(a => a.status === 'pending' && !isSnoozed(a, snoozedLocal) && !decidedLocal[a.id]),
    [approvals, snoozedLocal, decidedLocal],
  );
  const watchingList = useMemo(
    () => approvals.filter(a => a.status === 'pending' && isSnoozed(a, snoozedLocal) && !decidedLocal[a.id]),
    [approvals, snoozedLocal, decidedLocal],
  );
  const doneList = useMemo(() => {
    const server = approvals.filter(a => decidedToday(a));
    const local = Object.entries(decidedLocal).map(([id, d]) => {
      const a = approvals.find(x => x.id === id);
      return a ? { ...a, status: d.action, reviewed_at: new Date(d.at).toISOString() } : null;
    }).filter(Boolean) as ApprovalItem[];
    const seen = new Set(server.map(a => a.id));
    return [...local.filter(a => !seen.has(a.id)), ...server];
  }, [approvals, decidedLocal]);

  const visible = tab === 'decide' ? decideList : tab === 'watching' ? watchingList : doneList;
  const visibleIds = useMemo(() => visible.map(a => a.id), [visible]);

  // Keep focus valid when the list changes.
  useEffect(() => {
    if (focusedId && !visibleIds.includes(focusedId)) {
      setFocusedId(visibleIds[0] || null);
    }
  }, [visibleIds, focusedId]);

  // ---- N3.16 optimistic decide ----
  const decide = useCallback(async (id: string, action: 'approved' | 'rejected', reason?: string) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    setFailed(prev => { const n = { ...prev }; delete n[id]; return n; });
    setDecidedLocal(prev => ({ ...prev, [id]: { action, at: Date.now() } }));
    setReasonForId(null);
    try {
      const res = await apiFetch(`/api/v1/approvals/${id}/${action === 'approved' ? 'approve' : 'reject'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: reason ? JSON.stringify({ reason }) : undefined,
      });
      if (!res.ok) throw new Error(`Server said ${res.status}.`);
      await fetchApprovals();
    } catch (e: any) {
      // Visible rollback: the card returns with an honest error + retry.
      setDecidedLocal(prev => { const n = { ...prev }; delete n[id]; return n; });
      setFailed(prev => ({ ...prev, [id]: e.message || 'Request failed.' }));
    } finally {
      inFlight.current.delete(id);
    }
  }, [fetchApprovals]);

  const snooze = useCallback(async (id: string) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    const until = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    setFailed(prev => { const n = { ...prev }; delete n[id]; return n; });
    setSnoozedLocal(prev => ({ ...prev, [id]: until }));
    try {
      const res = await apiFetch(`/api/v1/approvals/${id}/snooze`, { method: 'POST' });
      if (!res.ok) throw new Error(`Server said ${res.status}.`);
      await fetchApprovals();
    } catch (e: any) {
      setSnoozedLocal(prev => { const n = { ...prev }; delete n[id]; return n; });
      setFailed(prev => ({ ...prev, [id]: e.message || 'Snooze failed.' }));
    } finally {
      inFlight.current.delete(id);
    }
  }, [fetchApprovals]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }, []);

  const clearSelected = useCallback(() => setSelected(new Set()), []);

  const bulkDecide = useCallback(async (action: 'approved' | 'rejected') => {
    const ids = [...selected].filter(id => decideList.some(a => a.id === id));
    clearSelected();
    for (const id of ids) {
      // Sequential — each card gets its own optimistic state + rollback.
      await decide(id, action);
    }
  }, [selected, decideList, decide, clearSelected]);

  // ---- N3.14 triage keys ----
  useTriageKeys(
    visibleIds,
    focusedId,
    setFocusedId,
    {
      onApprove: id => decide(id, 'approved'),
      onReject: id => setReasonForId(id),
      onSnooze: snooze,
      onOpen: id => setExpandedId(prev => (prev === id ? null : id)),
      onToggleSelect: toggleSelect,
    },
    !loading && !loadError && tab === 'decide',
  );

  // ---- N3.17 palette context actions ----
  useEffect(() => {
    return registerPaletteActions([
      {
        id: 'approve-focused', label: 'Approve focused card', hint: 'a',
        run: () => { if (focusedId) decide(focusedId, 'approved'); },
      },
      {
        id: 'reject-focused', label: 'Reject focused card', hint: 'r',
        run: () => { if (focusedId) setReasonForId(focusedId); },
      },
      {
        id: 'snooze-focused', label: 'Snooze focused card', hint: 's',
        run: () => { if (focusedId) snooze(focusedId); },
      },
      { id: 'tab-watching', label: 'Go to Watching tab', hint: 'inbox', run: () => switchTab('watching') },
      { id: 'tab-done', label: 'Go to Done tab', hint: 'inbox', run: () => switchTab('done') },
      { id: 'tab-decide', label: 'Go to Decide tab', hint: 'inbox', run: () => switchTab('decide') },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedId, decide, snooze]);

  const counts = { decide: decideList.length, watching: watchingList.length, done: doneList.length };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Approvals</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Review and approve pending items from your AI team
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
          <span className="t-mono" style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            {connected ? 'Live' : everConnected ? 'Offline' : 'Connecting…'}
          </span>
          <button onClick={fetchApprovals} disabled={loading} className="btn btn-secondary btn-sm">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* N3.18 one-time shortcut callout */}
      {showCallout && !loading && !loadError && (
        <div style={{
          margin: '12px 24px 0', padding: '10px 14px', borderRadius: 10,
          background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span className="t-meta" style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>
            The inbox runs on keyboard now — <span className="kbd">j</span>/<span className="kbd">k</span> move,{' '}
            <span className="kbd">a</span> approves, <span className="kbd">?</span> shows all shortcuts.
          </span>
          <button onClick={dismissCallout} className="btn btn-secondary btn-sm">Got it</button>
        </div>
      )}

      {/* N3.15 split inbox tabs */}
      <div className="flex items-center gap-1 px-6 pt-4" role="tablist" aria-label="Inbox tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => switchTab(t.id)}
            style={{
              padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              minHeight: 40, fontSize: 13.5, fontWeight: tab === t.id ? 700 : 500,
              background: tab === t.id ? 'var(--bg-2, #f4f4f0)' : 'transparent',
              color: tab === t.id ? 'var(--text)' : 'var(--text-faint)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            {t.label}
            <span className="t-mono" style={{
              fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 99,
              background: tab === t.id ? 'rgba(245,158,11,0.18)' : 'rgba(100,116,139,0.12)',
              color: tab === t.id ? '#b45309' : 'var(--text-faint)',
            }}>
              {loading || loadError ? '—' : counts[t.id]}
            </span>
          </button>
        ))}
        <span className="t-meta" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-faint)' }}>
          <span className="kbd">?</span> shortcuts
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6" style={{ position: 'relative' }}>
        {/* N3.14 bulk bar — appears only when cards are selected */}
        {selected.size > 0 && tab === 'decide' && (
          <div style={{
            position: 'sticky', top: 0, zIndex: 10, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            padding: '10px 14px', borderRadius: 12,
            background: 'var(--card, #fff)', border: '1px solid var(--border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
          }}>
            <span className="t-meta" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', flex: 1 }}>
              {selected.size} selected
            </span>
            <button
              onClick={() => bulkDecide('approved')}
              style={{ minHeight: 40, padding: '0 14px', borderRadius: 8, border: 'none', background: '#004B63', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Approve all
            </button>
            <button
              onClick={() => bulkDecide('rejected')}
              style={{ minHeight: 40, padding: '0 14px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', color: '#b91c1c', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Reject all
            </button>
            <button
              onClick={clearSelected}
              style={{ minHeight: 40, padding: '0 12px', borderRadius: 8, border: 'none', background: 'transparent', color: 'var(--text-faint)', fontSize: 13, cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-faint)' }}>
            <div className="t-mono">Loading approvals…</div>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3" style={{ color: 'var(--text-faint)' }}>
            <div className="t-mono" style={{ color: 'var(--danger)' }}>{loadError}</div>
            <div className="t-meta">Approval state is unknown — not empty. Check the API, then retry.</div>
            <button onClick={fetchApprovals} className="btn btn-secondary btn-sm">Tap to retry</button>
          </div>
        ) : tab === 'decide' && visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2" style={{ color: 'var(--text-faint)' }}>
            <div className="t-title" style={{ fontSize: 18, color: 'var(--text)' }}>Inbox zero.</div>
            <div className="t-meta">Nothing needs you right now. The company runs.</div>
          </div>
        ) : (
          <ApprovalQueue
            approvals={visible}
            onApprove={id => decide(id, 'approved')}
            onReject={id => setReasonForId(id)}
            onSnooze={snooze}
            selected={selected}
            onToggleSelect={toggleSelect}
            focusedId={focusedId}
            onFocusCard={setFocusedId}
            expandedId={expandedId}
            onToggleExpand={id => setExpandedId(prev => (prev === id ? null : id))}
            reasonForId={reasonForId}
            onReasonSubmit={(id, reason) => decide(id, 'rejected', reason)}
            onReasonCancel={() => setReasonForId(null)}
            failed={failed}
            onRetry={id => {
              const d = decidedLocal[id];
              decide(id, d ? d.action : 'approved');
            }}
            showTriage={tab === 'decide'}
          />
        )}
      </div>
    </div>
  );
}
