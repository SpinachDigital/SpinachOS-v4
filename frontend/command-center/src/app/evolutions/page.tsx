'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';
import Link from 'next/link';

interface EvolutionProposal {
  id: string;
  type: string;
  title: string;
  rationale: string;
  confidence: number;
  evidence: any[];
  status: 'proposed' | 'approved' | 'rejected' | 'applied';
  created_at: string;
  applied_at?: string;
  payload?: any;
}

interface LearnedPreference {
  id: string;
  scope: string;
  client_id: string | null;
  agent_profile: string | null;
  key: string;
  value: any;
  confidence: number;
  status: string;
  evidence_refs: any[];
  created_at: string;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  preference: { label: 'Preference', color: '#3b82f6' },
  playbook_fix: { label: 'Playbook Fix', color: '#8b5cf6' },
  cost_rule: { label: 'Cost Rule', color: '#f59e0b' },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  proposed: { bg: 'rgba(245,158,11,0.15)', color: '#b45309' },
  approved: { bg: 'rgba(34,197,94,0.15)', color: '#15803d' },
  rejected: { bg: 'rgba(239,68,68,0.12)', color: '#b91c1c' },
  applied: { bg: 'rgba(34,197,94,0.15)', color: '#15803d' },
};

function fmtTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return iso; }
}

export default function EvolutionsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [preferences, setPreferences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      const [pRes, prefRes] = await Promise.all([
        apiFetch('/api/v1/evolutions?limit=200'),
        apiFetch('/api/v1/evolutions/preferences?limit=200'),
      ]);
      if (pRes.ok) setProposals(await pRes.json());
      if (prefRes.ok) setPreferences(await prefRes.json());
    } catch (e) {
      console.error('Failed to fetch evolutions:', e);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/evolutions/${id}/apply`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (e) { console.error('Approve failed:', e); }
  };

  const handleDeny = async (id: string) => {
    try {
      const res = await apiFetch(`/api/v1/evolutions/${id}/deny`, { method: 'POST' });
      if (res.ok) fetchData();
    } catch (e) { console.error('Deny failed:', e); }
  };

  const filtered = proposals.filter(p => {
    const statusMatch = statusFilter === 'all' || p.status === statusFilter;
    const typeMatch = typeFilter === 'all' || p.type === typeFilter;
    return statusMatch && typeMatch;
  });

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="flex items-center justify-between px-6 py-5" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>Evolutions</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            Learning loop proposals — every card is an approval card in THE INBOX
          </p>
        </div>
        <button onClick={fetchData} className="btn btn-secondary btn-sm">Refresh</button>
      </div>

      <div className="flex items-center gap-4 px-6 py-3" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="t-meta" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg)', color: 'var(--text)' }}>
          <option value="all">All Status</option>
          <option value="proposed">Proposed</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="applied">Applied</option>
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="t-meta" style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg)', color: 'var(--text)' }}>
          <option value="all">All Types</option>
          <option value="preference">Preference</option>
          <option value="playbook_fix">Playbook Fix</option>
          <option value="cost_rule">Cost Rule</option>
        </select>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {proposals.length === 0 ? (
          <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-faint)' }}>
            <div className="t-meta">No evolution proposals yet — run the learning cycle or wait for daily cron</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(p => {
              const typeInfo = TYPE_LABELS[p.type] || { label: p.type, color: '#6b7280' };
              const statusInfo = STATUS_STYLE[p.status] || { bg: 'rgba(107,114,128,0.12)', color: '#6b7280' };

              return (
                <div key={p.id} className="flex flex-col gap-4" style={{ border: '1px solid var(--border-hairline)', borderRadius: 14, padding: 16, background: 'var(--card)', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="t-title" style={{ color: 'var(--text)', margin: 0 }}>{p.title}</h3>
                        <span className="t-mono" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: typeInfo.color + '20', color: typeInfo.color }}>{typeInfo.label}</span>
                        <span className="t-mono" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: statusInfo.bg, color: statusInfo.color }}>{p.status}</span>
                        <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Confidence: {Math.round(p.confidence * 100)}%</span>
                      </div>
                      <p className="t-meta mt-1" style={{ color: 'var(--text)', marginTop: 8 }}>{p.rationale}</p>
                      <div className="flex items-center gap-4 mt-2" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>
                        <span>Created: {fmtTime(p.created_at)}</span>
                        {p.applied_at && <span>Applied: {fmtTime(p.applied_at)}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.status === 'proposed' && (
                        <>
                          <button onClick={() => handleApprove(p.id)} className="btn btn-primary btn-sm">Approve</button>
                          <button onClick={() => handleDeny(p.id)} className="btn btn-secondary btn-sm">Deny</button>
                        </>
                      )}
                      {p.status === 'applied' && <span className="t-meta" style={{ color: 'var(--green)' }}>Applied</span>}
                      {p.status === 'rejected' && <span className="t-meta" style={{ color: 'var(--red)' }}>Denied</span>}
                    </div>
                  </div>
                  <details className="t-meta" style={{ color: 'var(--text-faint)', marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', color: 'var(--text-faint)' }}>Evidence ({p.evidence?.length || 0} refs)</summary>
                    <pre style={{ marginTop: 8, padding: 12, background: 'var(--bg-2)', borderRadius: 8, overflow: 'auto', maxHeight: 200, fontSize: 11 }}>{JSON.stringify(p.evidence, null, 2)}</pre>
                  </details>
                </div>
              );
            })}
          </div>
        )}

        {preferences.length > 0 && (
          <div className="mt-8">
            <h2 className="t-title" style={{ marginBottom: 12 }}>Approved Learned Preferences</h2>
            <div className="space-y-3">
              {preferences.map(p => (
                <div key={p.id} style={{ border: '1px solid var(--border-hairline)', borderRadius: 10, padding: 12, background: 'var(--card)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="t-mono" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}>Preference</span>
                      <span className="t-mono" style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: 'rgba(34,197,94,0.15)', color: '#15803d' }}>{p.status}</span>
                      <span className="t-meta" style={{ color: 'var(--text-faint)' }}>{p.scope} · {p.agent_profile || 'global'}</span>
                    </div>
                    <span className="t-meta" style={{ color: 'var(--text-faint)' }}>Key: {p.key}</span>
                  </div>
                  <details className="t-meta" style={{ color: 'var(--text-faint)', marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer' }}>Value + Evidence</summary>
                    <pre style={{ marginTop: 8, padding: 12, background: 'var(--bg-2)', borderRadius: 8, overflow: 'auto', maxHeight: 150, fontSize: 11 }}>{JSON.stringify({ value: p.value, evidence: p.evidence_refs }, null, 2)}</pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}