'use client';

// Clients — real directory wired to GET /api/v1/clients.
// Rows link to /clients/[id] (Client 360).
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Client {
  id: string;
  name: string;
  business_type?: string;
  location?: string;
  goal?: string;
  status?: string;
  services?: string[];
  metadata?: Record<string, any>;
  created_at?: string;
}

function statusPill(status?: string) {
  const s = (status || 'active').toLowerCase();
  const cls: Record<string, string> = {
    active: 'pill approved',
    paused: 'pill paused',
    completed: 'pill completed',
    archived: 'pill archived',
  };
  return <span className={cls[s] || 'pill draft'}>{s}</span>;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export default function ClientsPage() {
  const router = useRouter();
  const { connected, everConnected } = useWebSocket();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/v1/clients');
      if (!res.ok) throw new Error(`API ${res.status}`);
      const data = await res.json();
      setClients(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const visible = clients.filter((c) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.business_type?.toLowerCase().includes(q) ||
      c.location?.toLowerCase().includes(q)
    );
  });

  const counts = {
    total: clients.length,
    active: clients.filter((c) => (c.status || 'active') === 'active').length,
    paused: clients.filter((c) => c.status === 'paused').length,
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Clients</h1>
          <p className="sub">
            {loading ? 'Loading clients…' : error ? '— clients unavailable' : `${counts.total} total · ${counts.active} active · ${counts.paused} paused`}
          </p>
        </div>
        <div className="actions">
          <span className="live-badge">
            <span className={`dot ${connected ? 'dot-green dot-pulse' : everConnected ? 'dot-red' : 'dot-gray'}`} />
            {connected ? 'Live' : everConnected ? 'Offline' : 'Connecting…'}
          </span>
          <input
            className="input"
            style={{ width: 220, minWidth: 0, flex: '1 1 140px', maxWidth: 260 }}
            placeholder="Search clients…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <button className="btn btn-secondary btn-sm" onClick={fetchClients} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="table-wrap" style={{ padding: 14 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 44, marginBottom: 8 }} />
            ))}
          </div>
        ) : error ? (
          <div className="empty-state">
            <h3>Couldn't load clients</h3>
            <p>{error} Check your connection and try again.</p>
            <button type="button" className="btn" style={{ minHeight: 44, marginTop: 12 }} onClick={() => void fetchClients()}>
              Retry
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <h3>{clients.length === 0 ? 'No clients yet' : 'No matches'}</h3>
            {clients.length === 0 ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--muted-foreground)', margin: '0 0 16px' }}>
                  Onboard your first client — the directory, pipelines, and delivery story all start here.
                </p>
                <button className="btn btn-primary btn-sm" type="button" onClick={() => router.push('/leads')}
                  style={{ display: 'inline-flex', alignItems: 'center' }}>
                  + Onboard first client
                </button>
              </>
            ) : (
              <p style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Try a different search term.</p>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Industry</th>
                  <th>Location</th>
                  <th>Package</th>
                  <th>Status</th>
                  <th>Onboarded</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => router.push(`/clients/${c.id}`)}>
                    <td data-label="Client">
                      <span className="cell-main">{c.name}</span>
                      {c.goal && <div className="cell-dim">{c.goal.slice(0, 60)}{c.goal.length > 60 ? '…' : ''}</div>}
                    </td>
                    <td data-label="Industry">{c.business_type || '—'}</td>
                    <td data-label="Location">{c.location || '—'}</td>
                    <td data-label="Package">
                      {c.metadata?.package_key ? (
                        <span className="badge badge-green">{c.metadata.package_key.replace(/_/g, ' ')}</span>
                      ) : (
                        <span className="cell-dim">—</span>
                      )}
                    </td>
                    <td data-label="Status">{statusPill(c.status)}</td>
                    <td data-label="Onboarded" className="cell-dim">{fmtDate(c.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {clients.length > 0 && (<div className="info-note">
          Client 360 lives one click away — open any row for timeline, pipelines, deliverables,
          DNA summary, approvals, and retainer schedule.{' '}
          <Link href="/approvals" style={{ color: 'var(--green-bright)' }}>Pending approvals →</Link>
        </div>)}
      </div>
    </div>
  );
}
