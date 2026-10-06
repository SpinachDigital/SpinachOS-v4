'use client';

// Approvals — Operate surface. Warm light tokens (design v6), inline stats, queue rows.
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';
import type { FeedEntry } from '@/lib/office/wsStore';

// ApprovalQueue uses lucide-react icons - load it client-only
const ApprovalQueue = dynamic(() => import('@/components/ApprovalQueue').then(m => ({ default: m.ApprovalQueue })), {
  ssr: false,
  loading: () => <div className="t-meta" style={{ color: 'var(--text-faint)' }}>Loading approvals…</div>,
});

interface ApprovalItem {
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
  // Phase 6 GOAL 3 triage fields
  risk_tier?: string;
  triage_score?: number;
  triage_reasons?: string[];
  blocking?: boolean;
}

const WORKFLOW_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'WIN', label: 'WIN', types: ['outreach', 'onboarding'] },
  { id: 'DELIVER', label: 'DELIVER', types: ['gate', 'deliverable_approval', 'task_approval', 'stuck_stage'] },
  { id: 'CREATE', label: 'CREATE', types: ['content', 'design', 'strategy'] },
  { id: 'GROW', label: 'GROW', types: ['publish', 'campaign'] },
] as const;

export default function ApprovalsPage() {
  const { connected, feed } = useWebSocket();
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState<string | null>(null);
  // Phase 6 GOAL 3: triage state — smart sort, filters, search, bulk
  const [workflow, setWorkflow] = useState<'all' | 'WIN' | 'DELIVER' | 'CREATE' | 'GROW'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | keyof TYPE_FILTER>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<'approve' | 'reject' | null>(null);
  // Optionally bind onToggleSelect from parent if needed
  const onToggleSelect = (id: string) => setSelected(s => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Phase 6 GOAL 3: triage state — smart sort, filters, search, bulk
  const [workflow, setWorkflow] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState<'approve' | 'reject' | null>(null);

  // Fetch approvals on mount and when feed updates
  const fetchApprovals = useCallback(async () => {
    try {
      // Phase 6 GOAL 3: triage=1 → smart-priority sort server-side
      // (blocking first, score desc — scores recompute on every fetch:
      // new card, age crossing SLA, pipeline unblocked → fresh ranking).
      const res = await apiFetch('/api/v1/approvals?triage=1&limit=200');
      if (res.ok) {
        const data = await res.json();
        setApprovals(data);
      }
    } catch (e) {
      console.error('Failed to fetch approvals:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  // React to WebSocket approval events
  useEffect(() => {
    const latestApprovalEvent = [...feed].reverse().find(f => f.action === 'created' || f.action === 'approved' || f.action === 'rejected');
    if (latestApprovalEvent) {
      fetchApprovals();
    }
  }, [feed, fetchApprovals]);

  const handleApprove = async (id: string) => {
    setActionPending(id);
    try {
      const res = await apiFetch(`/api/v1/approvals/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        fetchApprovals();
      }
    } catch (e) {
      console.error('Approve failed:', e);
    } finally {
      setActionPending(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionPending(id);
    try {
      const res = await apiFetch(`/api/v1/approvals/${id}/reject`, { method: 'POST' });
      if (res.ok) {
        fetchApprovals();
      }
    } catch (e) {
      console.error('Reject failed:', e);
    } finally {
      setActionPending(null);
    }
  };

  const pending = approvals.filter(a => a.status === 'pending').length;
  const approved = approvals.filter(a => a.status === 'approved').length;
  const rejected = approvals.filter(a => a.status === 'rejected').length;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header — left-aligned + action row */}
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
            {connected ? 'Live' : 'Offline'}
          </span>
          <button onClick={fetchApprovals} disabled={loading} className="btn btn-secondary btn-sm">
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Stats — inline text row, not monument cards */}
      <div className="flex items-center gap-6 px-6 py-3" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--amber)', fontWeight: 700 }}>{pending}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Pending</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--green)', fontWeight: 700 }}>{approved}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Approved</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--red)', fontWeight: 700 }}>{rejected}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Rejected</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--text)', fontWeight: 700 }}>{approvals.length}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Total</span>
        </span>
      </div>

      {/* Approvals list */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-faint)' }}>
            <div className="t-mono">Loading approvals…</div>
          </div>
        ) : (
          <ApprovalQueue
            approvals={approvals}
            onApprove={handleApprove}
            onReject={handleReject}
            actionPending={actionPending}
          />
        )}
      </div>
    </div>
  );
}
