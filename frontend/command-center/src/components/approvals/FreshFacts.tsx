'use client';

// FreshFacts — N3.20-frontend: "what happens if I approve?" answered with
// LIVE facts at confirm time. Fetches GET /api/v1/approvals/:id/facts on
// demand. Progressive enhancement: if the endpoint is missing (404), the
// whole block hides silently — the old confirm copy stays.

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/auth';

interface Facts {
  fresh_facts?: { headline?: string; details?: string[]; cost_estimate?: string | null };
  facts_at?: string;
}

export default function FreshFacts({ approvalId }: { approvalId: string }) {
  const [open, setOpen] = useState(false);
  const [facts, setFacts] = useState<Facts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await apiFetch(`/api/v1/approvals/${approvalId}/facts`);
      if (r.status === 404) { setUnsupported(true); return; }
      if (!r.ok) throw new Error(`Couldn't fetch facts (${r.status}).`);
      setFacts(await r.json());
    } catch (e: any) {
      setError(e.message || "Couldn't reach the API.");
    } finally {
      setLoading(false);
    }
  }, [approvalId]);

  if (unsupported) return null;

  return (
    <div style={{ marginTop: 10 }}>
      {!open ? (
        <button
          onClick={() => { setOpen(true); if (!facts && !loading) load(); }}
          className="t-meta"
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontSize: 12.5, color: 'var(--accent)', fontWeight: 600,
          }}
        >
          What happens if I approve? →
        </button>
      ) : (
        <div style={{
          border: '1px solid var(--border-hairline, #eee)', borderRadius: 10,
          padding: 12, background: 'var(--bg-2, #fafaf7)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="t-mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Live facts
            </span>
            <button
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: 12 }}
            >
              Hide
            </button>
          </div>
          {loading && <div className="t-meta" style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>Checking the current state…</div>}
          {error && (
            <div>
              <div className="t-meta" style={{ fontSize: 12.5, color: 'var(--danger)' }}>{error}</div>
              <button onClick={load} className="t-meta" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12.5, marginTop: 4 }}>
                Retry
              </button>
            </div>
          )}
          {facts?.fresh_facts && (
            <div>
              {facts.fresh_facts.headline && (
                <div className="t-meta" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  {facts.fresh_facts.headline}
                </div>
              )}
              {(facts.fresh_facts.details || []).map((d, i) => (
                <div key={i} className="t-meta" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 3 }}>
                  · {d}
                </div>
              ))}
              {facts.fresh_facts.cost_estimate && (
                <div className="t-meta" style={{ fontSize: 12.5, color: 'var(--text-dim)', marginTop: 4 }}>
                  Est. cost: {facts.fresh_facts.cost_estimate}
                </div>
              )}
              {facts.facts_at && (
                <div className="t-mono" style={{ fontSize: 10.5, color: 'var(--text-faint)', marginTop: 8 }}>
                  checked just now · {new Date(facts.facts_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
