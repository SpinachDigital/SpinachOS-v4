'use client';

// HierarchyTree — leadership → HOD → bench (Part B in-app representation).
// Live state from WS store, dormant HODs honestly labeled, benches are
// on-demand slots (loaded per task, released after — no persistent brains).
import { useEffect, useState } from 'react';
import { useSpinachStore } from '@/store/spinach-store';
import { apiFetch } from '@/lib/auth';

type Bench = { profile: string; tier: string; status: string; current_task: string | null };
type HOD = { profile: string; state: string; activity: string | null; display_name: string | null; is_dormant: boolean; bench: Bench[] };
type Lead = { profile: string; state: string; activity: string | null; display_name: string | null; children: HOD[] };
type TreeData = { leadership: Lead[]; orphans: HOD[]; total_hods: number; dormant: string[] };

const TIER_LABEL: Record<string, string> = {
  leadership: 'LEADERSHIP',
  hod: 'HOD',
  executive: 'EXEC',
};

function StateDot({ state, dormant }: { state?: string; dormant?: boolean }) {
  const cls = dormant ? 'd idle' : state === 'working' ? 'd busy' : state === 'blocked' ? 'd blocked' : 'd';
  return <span className={`agent-st ${cls}`}><span className={cls.includes('idle') ? 'd idle' : cls.split(' ')[1] ? cls : 'd'} /></span>;
}

function StateBadge({ state, dormant }: { state?: string; dormant?: boolean }) {
  if (dormant) return <span className="pill failed" style={{ opacity: 0.8 }}>DORMANT</span>;
  if (state === 'working') return <span className="pill running">WORKING</span>;
  if (state === 'blocked') return <span className="pill failed">BLOCKED</span>;
  if (state === 'thinking') return <span className="pill running">THINKING</span>;
  return <span className="pill completed">ONLINE</span>;
}

export default function HierarchyTree() {
  const [tree, setTree] = useState<TreeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const agentStates = useSpinachStore((s) => s.agentStates);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await apiFetch('http://localhost:4000/api/v1/hierarchy');
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
        const j = await r.json();
        if (alive) setTree(j);
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  if (error) return <div className="empty-state" style={{ padding: 40 }}><h3>Hierarchy unavailable</h3><p>{error}</p></div>;
  if (!tree) return <div className="t-mono" style={{ color: 'var(--text-faint)', padding: 40 }}>Loading org tree…</div>;

  const liveState = (p: string) => agentStates[p]?.state;
  const liveActivity = (p: string) => agentStates[p]?.activity;

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {tree.leadership.map((lead) => (
        <div className="panel" key={lead.profile}>
          <div className="panel-head">
            <h3>{lead.display_name || lead.profile}</h3>
            <StateBadge state={liveState(lead.profile) || lead.state} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(lead.children || []).map((hod) => {
              const key = `${lead.profile}/${hod.profile}`;
              const open = expanded[key];
              const st = liveState(hod.profile) || hod.state;
              const act = liveActivity(hod.profile) || hod.activity;
              return (
                <div key={hod.profile}>
                  <button
                    className="nav-item"
                    style={{ width: '100%', background: 'transparent', border: '1px solid transparent', cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => toggle(key)}
                    type="button"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"
                      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', flex: 'none' }}>
                      <path d="M9 6l6 6-6 6" />
                    </svg>
                    <div className="nav-text" style={{ flex: 1 }}>
                      <b>{hod.display_name || hod.profile}</b>
                      <span>{act || 'idle'}</span>
                    </div>
                    <StateBadge state={st} dormant={hod.is_dormant} />
                  </button>
                  {open && (
                    <div style={{ marginLeft: 40, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4, marginBottom: 6 }}>
                      {hod.bench?.length ? hod.bench.map((b) => (
                        <div className="agent-row" key={b.profile} style={{ padding: '4px 2px' }}>
                          <div className="agent-ic" style={{ width: 24, height: 24 }}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="12" height="12">
                              <circle cx="12" cy="8" r="3.2" /><path d="M5 20c.7-3 3-4.8 7-4.8s6.3 1.8 7 4.8" />
                            </svg>
                          </div>
                          <div className="an">
                            <b style={{ fontSize: 11.5 }}>{b.profile.replace(/_/g, ' ')}</b>
                            <span>{b.current_task || 'available — on demand'}</span>
                          </div>
                          <div className="agent-st"><span className="d idle" />{b.status}</div>
                        </div>
                      )) : (
                        <div className="t-meta" style={{ color: 'var(--text-faint)', padding: '4px 2px' }}>No bench slots configured</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {(!lead.children || lead.children.length === 0) && (
              <div className="t-meta" style={{ color: 'var(--text-faint)' }}>No direct reports</div>
            )}
          </div>
        </div>
      ))}
      {tree.orphans?.length > 0 && (
        <div className="panel">
          <div className="panel-head"><h3>Unassigned HODs</h3></div>
          {tree.orphans.map(h => <div className="agent-row" key={h.profile}><div className="an"><b>{h.profile}</b><span>reports_to not set</span></div></div>)}
        </div>
      )}
      <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
        {tree.total_hods} HODs · {tree.dormant.length} dormant {tree.dormant.length > 0 && `(${tree.dormant.join(', ')})`} · benches load on demand from the 279 specialist pool
      </div>
    </div>
  );
}