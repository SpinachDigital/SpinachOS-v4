/*
 * app/pnl/page.tsx — Sprint 11 §2: the P&L view (one clear page —
 * observability, not accounting). Per client: "AI me ₹X padta hai, ₹Y deta
 * hai, margin Z%". Revenue = the monthly_value field (manual input, honest —
 * never invented/backfilled). Per-agent rollup (which agent burns the most)
 * + per-model breakdown. Every number traces to a usage_logs row.
 */
'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

type ClientRow = {
  client_id: string; name: string; status?: string;
  ai_cost_inr: number; calls: number;
  monthly_value: number | null; margin_pct: number | null;
};
type AgentRow = { agent_profile: string; ai_cost_inr: number; calls: number; tokens: number };
type ModelRow = { model: string; ai_cost_inr: number; calls: number; tokens: number };
type Pnl = {
  clients: ClientRow[]; agents: AgentRow[]; models: ModelRow[];
  totals: { costUsd: number; costInr: number; calls: number; unpricedCalls: number };
};

const inr = (n: number | null | undefined) =>
  n == null ? '—' : '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

export default function PnlPage() {
  const [pnl, setPnl] = useState<Pnl | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editClient, setEditClient] = useState<ClientRow | null>(null);
  const [revenueInput, setRevenueInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [styleScores, setStyleScores] = useState<any[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch('/api/v1/pnl').then((r) => (r.ok ? r.json() : null));
      setPnl(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to load P&L');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Phase 7-FIX FIX 6: weekly avg style score per agent — drift visible
  // where the founder already looks (P&L/ops view).
  useEffect(() => {
    apiFetch('/api/v1/evolutions/style-weekly').then((r) => (r.ok ? r.json() : []))
      .then((d) => setStyleScores(Array.isArray(d) ? d : []))
      .catch(() => setStyleScores([]));
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const saveRevenue = async () => {
    if (!editClient) return;
    const v = Number(revenueInput);
    if (isNaN(v) || v < 0) { flash('Enter a number ≥ 0 — manual input, never invented'); return; }
    setBusy(true);
    try {
      await apiFetch('/api/v1/pnl/revenue', {
        method: 'POST',
        body: JSON.stringify({ client_id: editClient.client_id, monthly_value: v }),
      });
      flash(`${editClient.name}: monthly revenue set to ${inr(v)} (manual)`);
      setEditClient(null);
      void load();
    } catch (e: any) {
      flash(e?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const t = pnl?.totals;

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg, transparent)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <div>
          <h1 className="t-title" style={{ color: 'var(--text)' }}>P&L</h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            AI cost vs client revenue — every number traces to a usage_logs row
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {/* Totals strip — inline text, not monument cards */}
      <div className="flex items-center gap-6 px-6 py-3 flex-wrap" style={{ borderBottom: '1px solid var(--border-hairline)' }}>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>{inr(t?.costInr)}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>total AI cost</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>${t?.costUsd ?? '—'}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>USD</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="t-mono" style={{ color: 'var(--text)', fontWeight: 700, fontSize: 15 }}>{t?.calls ?? 0}</span>
          <span className="t-meta" style={{ color: 'var(--text-faint)' }}>logged calls</span>
        </span>
        {(t?.unpricedCalls ?? 0) > 0 && (
          <span className="flex items-center gap-2">
            <span className="t-mono" style={{ color: 'var(--amber, #b45309)', fontWeight: 700, fontSize: 15 }}>{t!.unpricedCalls}</span>
            <span className="t-meta" style={{ color: 'var(--text-faint)' }}>unpriced (no rate)</span>
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {loading ? (
          <div className="flex items-center justify-center h-48" style={{ color: 'var(--text-faint)' }}>
            <span className="t-mono">Loading P&L…</span>
          </div>
        ) : error ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--red, #b91c1c)' }}>
            <p className="t-meta">{error}</p>
            <button onClick={() => void load()} className="btn btn-secondary btn-sm mt-3" style={{ minHeight: 44 }}>Retry</button>
          </div>
        ) : (
          <>
            {/* Per-client */}
            <section>
              <h2 className="t-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 10 }}>
                Per client — AI cost vs revenue
              </h2>
              {pnl!.clients.length === 0 ? (
                <p className="t-meta" style={{ color: 'var(--text-faint)' }}>No clients yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pnl!.clients.map((c) => (
                    <div key={c.client_id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                      padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border-hairline)', background: 'var(--card, #fff)',
                    }}>
                      <div style={{ flex: 1, minWidth: 140 }}>
                        <p className="t-meta" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{c.name}</p>
                        <p className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                          {inr(c.ai_cost_inr)} AI cost · {c.calls} calls
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p className="t-mono" style={{ fontSize: 12, color: 'var(--text)' }}>
                          {c.monthly_value == null ? 'no revenue set' : `${inr(c.monthly_value)}/mo`}
                        </p>
                        <p className="t-mono" style={{
                          fontSize: 12, fontWeight: 700,
                          color: c.margin_pct == null ? 'var(--text-faint)' : c.margin_pct >= 50 ? 'var(--green, #4CAF50)' : c.margin_pct >= 0 ? 'var(--amber, #b45309)' : 'var(--red, #b91c1c)',
                        }}>
                          {c.margin_pct == null ? 'set revenue →' : `margin ${c.margin_pct}%`}
                        </p>
                      </div>
                      <button
                        onClick={() => { setEditClient(c); setRevenueInput(c.monthly_value == null ? '' : String(c.monthly_value)); }}
                        className="btn btn-secondary btn-sm"
                        style={{ minHeight: 44, padding: '6px 12px', fontSize: 11.5 }}
                      >
                        {c.monthly_value == null ? 'Set revenue' : 'Edit'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Per-agent rollup */}
            <section>
              <h2 className="t-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 10 }}>
                Per agent — which agent burns the most
              </h2>
              {(pnl!.agents.length === 0) ? (
                <p className="t-meta" style={{ color: 'var(--text-faint)' }}>No logged AI calls yet — run a task and it lands here.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pnl!.agents.map((a) => {
                    const max = pnl!.agents[0].ai_cost_inr || 1;
                    const pct = Math.max(2, Math.round((a.ai_cost_inr / max) * 100));
                    return (
                      <div key={a.agent_profile} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="t-mono" style={{ width: 150, flexShrink: 0, fontSize: 11.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.agent_profile}</span>
                        <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--bg-2, rgba(0,0,0,0.05))', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent, #004B63)', borderRadius: 999 }} />
                        </div>
                        <span className="t-mono" style={{ width: 90, textAlign: 'right', fontSize: 11.5, color: 'var(--text-faint)' }}>{inr(a.ai_cost_inr)} · {a.calls}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Phase 7-FIX FIX 6: weekly avg style score per agent */}
            <section>
              <h2 className="t-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 10 }}>
                Style score — weekly avg per agent (drift)
              </h2>
              {(styleScores.length === 0) ? (
                <p className="t-meta" style={{ color: 'var(--text-faint)' }}>No linted cards yet — style scores appear after agents produce inbox cards.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {styleScores.map((s: any) => (
                    <div key={s.agent || s.agent_profile} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="t-mono" style={{ width: 150, flexShrink: 0, fontSize: 11.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.agent || s.agent_profile}</span>
                      <div style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--bg-2, rgba(0,0,0,0.05))', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(2, Math.min(100, (Number(s.avg_score ?? s.avg ?? 0) / 10) * 100))}%`, height: '100%', background: Number(s.avg_score ?? s.avg ?? 0) >= 6 ? 'var(--green, #4CAF50)' : 'var(--amber, #f59e0b)', borderRadius: 999 }} />
                      </div>
                      <span className="t-mono" style={{ width: 90, textAlign: 'right', fontSize: 11.5, color: 'var(--text-faint)' }}>{Number(s.avg_score ?? s.avg ?? 0).toFixed(1)}/10 · {s.cards ?? s.count ?? 0} cards</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Per-model */}
            <section>
              <h2 className="t-mono" style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-faint)', marginBottom: 10 }}>
                Per model
              </h2>
              {(pnl!.models.length === 0) ? (
                <p className="t-meta" style={{ color: 'var(--text-faint)' }}>No models used yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {pnl!.models.map((m) => (
                    <div key={m.model} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="t-mono" style={{ flex: 1, fontSize: 11.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.model}</span>
                      <span className="t-mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{m.tokens.toLocaleString('en-IN')} tok · {m.calls} calls</span>
                      <span className="t-mono" style={{ width: 80, textAlign: 'right', fontSize: 11.5, fontWeight: 600, color: 'var(--text)' }}>{inr(m.ai_cost_inr)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Revenue edit modal — manual, honest */}
      {editClient && (
        <div onClick={() => setEditClient(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--card, #fff)', borderRadius: 16, padding: 20, maxWidth: 420, width: '100%', border: '1px solid var(--border-hairline)' }}>
            <h3 className="t-meta" style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)', marginBottom: 4 }}>Monthly revenue — {editClient.name}</h3>
            <p className="t-mono" style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 12 }}>
              Manual input — the real invoice value. Never invented, never backfilled.
            </p>
            <input
              value={revenueInput}
              onChange={(e) => setRevenueInput(e.target.value)}
              placeholder="e.g. 15000"
              aria-label="Monthly revenue in rupees"
              inputMode="numeric"
              className="t-mono"
              style={{ width: '100%', minHeight: 44, padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border-hairline)', background: 'var(--bg-2)', color: 'var(--text)', fontSize: 14 }}
            />
            <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
              <button onClick={() => setEditClient(null)} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>Cancel</button>
              <button onClick={() => void saveRevenue()} disabled={busy} className="btn btn-primary btn-sm" style={{ minHeight: 44 }}>
                {busy ? 'Saving…' : 'Save revenue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: 'var(--slate, #0A0A0A)', color: '#fff', padding: '10px 18px', borderRadius: 999, fontSize: 12.5, zIndex: 60, boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }} className="t-meta">
          {toast}
        </div>
      )}
    </div>
  );
}
