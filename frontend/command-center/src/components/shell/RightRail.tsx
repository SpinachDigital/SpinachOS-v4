'use client';

// RightRail — reference right column: Today checklist / AI Agents / System Health.
// Live data from the API bridge endpoints (direct browser → API), 30s refresh.
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation'; // Sprint 2: no dead buttons
import { apiFetch } from '@/lib/auth';

// The API host shown in the health widget — derived from the real configured
// base, never the stale localhost-era ":4000" label.
function apiHost(): string {
  try {
    const h = new URL(process.env.NEXT_PUBLIC_API_BASE || '').host;
    return h || 'API';
  } catch {
    return 'API';
  }
}

type AgentRow = { profile: string; state: string; activity?: string };
type HealthRow = { name: string; status: string; value?: string };
type Slot = { id: string; title: string; time?: string; done: boolean };

// UX pass (2026-10-17): the rail showed snake_case ids and 10-char truncated
// activity with zero context. Human names + 44-char preview + relative time.
const HUMAN_AGENT: Record<string, string> = {
  ceo: 'CEO', cto: 'CTO', orchestrator: 'Orchestrator', engineer: 'Engineering',
  designer: 'Design', social: 'Social', seo_specialist: 'SEO Specialist',
  research: 'Research', sales: 'Sales', ads_manager: 'Ads Manager',
  ops: 'Ops', hr_director: 'HR Director', content: 'Content', hr: 'HR',
  director: 'Director', founder: 'You',
};
const humanAgent = (id: string) => HUMAN_AGENT[String(id || '').toLowerCase()] || id;
const clip = (s: string, n = 44) => {
  const t = String(s || '').trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t;
};
const relTime = (iso?: string) => {
  if (!iso) return '';
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
};

export default function RightRail() {
  const router = useRouter(); // Sprint 2: wire View All Agents + Today chevron
  const [today, setToday] = useState<Slot[]>([]);
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [online, setOnline] = useState(0);
  const [health, setHealth] = useState<HealthRow[]>([]);
  // Phase 2 Task 1: first-paint loading state — the previous code rendered
  // "checking…"/"Agents offline" for up to 30s before the first fetch landed.
  const [loadedOnce, setLoadedOnce] = useState(false);
  // Phase 2 Task 3: API unreachable → fail loudly, not silently
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        // N4-fix: bridge endpoints go direct (browser → API) via apiFetch.
        // The Next.js /api/* rewrite proxy 500s from the server, which made
        // this widget report OFFLINE while the API was actually up.
        const [t, a, h] = await Promise.all([
          apiFetch('/api/schedule/today').then(r => (r.ok ? r.json() : null)),
          apiFetch('/api/agents').then(r => (r.ok ? r.json() : null)),
          apiFetch('/api/system/health').then(r => (r.ok ? r.json() : null)),
        ]);
        if (!alive) return;
        // today: {date, slots:[{id,title,sub,time,done}]}
        if (t && Array.isArray(t.slots)) setToday(t.slots.map((x: any) => ({ id: x.id, title: x.title, time: x.time, done: !!x.done })));
        // agents: {online, list:[{name, task, status, icon}]}
        if (a && Array.isArray(a.list)) {
          setAgents(a.list.map((x: any) => ({ profile: x.name, state: x.status === 'online' ? 'idle' : x.status, activity: x.task })));
          setOnline(a.online ?? a.list.length);
        }
        // health: [{name, state, value}]
        if (Array.isArray(h)) setHealth(h.map((x: any) => ({ name: x.name, status: x.state === 'ok' ? 'ok' : x.state, value: x.value })));
        setApiError(null);
        setLoadedOnce(true);
      } catch {
        // Phase 2 Task 3: API unreachable → loud error banner (not silent)
        if (alive) {
          setApiError(`API unreachable — the app can't reach ${apiHost()}.`);
          setLoadedOnce(true); // settle the pill: "Checking…" must never stick forever
        }
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // The health pill tells the truth: derived from actual fetch state,
  // never hardcoded. (QA #1: "ALL OPERATIONAL" next to "API unreachable".)
  const healthPill = () => {
    if (!loadedOnce) return <span className="pill">Checking…</span>;
    if (apiError) return <span className="pill" style={{ background: 'rgba(239,68,68,.12)', color: 'var(--danger)' }}>Degraded</span>;
    if (health.length === 0) return <span className="pill" style={{ background: 'rgba(239,68,68,.12)', color: 'var(--danger)' }}>Offline</span>;
    const down = health.filter(h => h.status === 'down').length;
    const warn = health.filter(h => h.status === 'warn').length;
    if (down > 0) return <span className="pill" style={{ background: 'rgba(239,68,68,.12)', color: 'var(--danger)' }}>Degraded</span>;
    if (warn > 0) return <span className="pill" style={{ background: 'rgba(245,158,11,.12)', color: 'var(--amber, #f59e0b)' }}>Degraded</span>;
    return <span className="pill completed">All Operational</span>;
  };

  return (
    <>
      {apiError && (
        <div className="panel" style={{ borderColor: 'var(--danger)', background: 'rgba(239, 68, 68, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--danger)', fontWeight: 600 }}>
            <span className="d down" /> {apiError}
          </div>
        </div>
      )}
      <section className="panel">
        <div className="panel-head"><h3>Today</h3><button className="link" type="button" onClick={() => router.push('/settings')} aria-label="Open settings">›</button></div>
        <div className="today-date">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div>
          {!loadedOnce && today.length === 0 && (
            <>
              <div className="skeleton" style={{ height: 14, width: '80%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '60%', marginBottom: 8 }} />
              <div className="skeleton" style={{ height: 14, width: '70%' }} />
            </>
          )}
          {loadedOnce && today.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No items on today&rsquo;s schedule.</div>}
          {today.map(s => (
            <div className="slot" key={s.id}>
              {/* N1.2: was a <button> with no onClick — a checkbox that could never be
                  checked. Now a plain status dot; no fake interactivity. */}
              <span className={`ck${s.done ? ' done' : ''}`} aria-hidden="true" />
              <div className={`st${s.done ? ' done' : ''}`}>
                <b>{s.title}</b>
                {s.time && <span>{s.time}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>AI Agents <span style={{ color: 'var(--green-bright)', fontSize: 11, fontWeight: 600 }}>{agents.length ? `${online}/${agents.length} online` : ''}</span></h3>
          <button className="link" type="button" onClick={() => router.push('/agents')} aria-label="Open agents">›</button>
        </div>
        <div>
          {!loadedOnce && agents.length === 0 && (
            <>
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="agent-row" style={{ opacity: 0.5 }}>
                  <div className="skeleton" style={{ width: 28, height: 28, borderRadius: 8 }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: 12, width: '55%', marginBottom: 5 }} />
                    <div className="skeleton" style={{ height: 10, width: '75%' }} />
                  </div>
                </div>
              ))}
            </>
          )}
          {loadedOnce && agents.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Agents offline — start the office with scripts/start-all.ps1.</div>}
          {agents.slice(0, 8).map(a => (
            <div className="agent-row" key={a.profile}>
              <div className="agent-ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                  <rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M8 4h8" />
                </svg>
              </div>
              <div className="an">
                <b>{humanAgent(a.profile)}</b>
                <span>{clip(a.activity || '') || a.state}</span>
              </div>
              <div className="agent-st">
                {a.state === 'working' ? <span className="d busy" /> : a.state === 'blocked' ? <span className="d blocked" /> : <span className="d" />}
                {a.state}
              </div>
            </div>
          ))}
        </div>
        <button className="hud-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} type="button" onClick={() => router.push('/agents')}>View All Agents</button>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>System Health</h3>{healthPill()}</div>
        <div>
          {!loadedOnce && health.length === 0 && (
            <>
              {[0, 1, 2].map(i => (
                <div key={i} className="health-row">
                  <div className="skeleton" style={{ width: 7, height: 7, borderRadius: '50%' }} />
                  <div className="skeleton" style={{ height: 11, width: '40%' }} />
                  <div className="skeleton" style={{ height: 11, width: '20%', marginLeft: 'auto' }} />
                </div>
              ))}
            </>
          )}
          {loadedOnce && health.length === 0 && (
            <div className="health-row"><span className="d down" /><b>{apiHost()}</b><span className="hv">unreachable</span></div>
          )}
          {health.map(h => (
            <div className="health-row" key={h.name}>
              <span className={`d${h.status === 'warn' ? ' warn' : ''}${h.status === 'down' ? ' down' : ''}`} />
              <b>{h.name}</b>
              <span className="hv">{h.value}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}