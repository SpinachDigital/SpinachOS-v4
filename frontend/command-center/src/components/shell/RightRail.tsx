'use client';

// RightRail — reference right column: Today checklist / AI Agents / System Health.
// Live data from the :4000 bridge endpoints, 30s refresh.
import { useEffect, useState } from 'react';

type AgentRow = { profile: string; state: string; activity?: string };
type HealthRow = { name: string; status: string; value?: string };
type Slot = { id: string; title: string; time?: string; done: boolean };

export default function RightRail() {
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
        const [t, a, h] = await Promise.all([
          fetch('/api/schedule/today').then(r => (r.ok ? r.json() : null)),
          fetch('/api/agents').then(r => (r.ok ? r.json() : null)),
          fetch('/api/system/health').then(r => (r.ok ? r.json() : null)),
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
        if (alive) setApiError('API :4000 unreachable — check scripts/start-all.ps1 or run the watchdog.');
      }
    };
    load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return (
    <>
      {apiError && (
        <div className="panel" style={{ borderColor: 'var(--red)', background: 'rgba(239, 68, 68, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--red)', fontWeight: 600 }}>
            <span className="d down" /> {apiError}
          </div>
        </div>
      )}
      <section className="panel">
        <div className="panel-head"><h3>Today</h3><button className="link" type="button">›</button></div>
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
              <button className={`ck${s.done ? ' done' : ''}`} type="button" aria-label="toggle" />
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
          <h3>AI Agents <span style={{ color: 'var(--green-bright)', fontSize: 11, fontWeight: 600 }}>{online ? `${online} online` : ''}</span></h3>
          <button className="link" type="button">›</button>
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
                <b>{a.profile}</b>
                <span>{a.activity || a.state}</span>
              </div>
              <div className="agent-st">
                {a.state === 'working' ? <span className="d busy" /> : a.state === 'blocked' ? <span className="d blocked" /> : <span className="d" />}
                {a.state}
              </div>
            </div>
          ))}
          {agents.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Agents offline.</div>}
        </div>
        <button className="hud-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} type="button">View All Agents</button>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>System Health</h3><span className="pill completed">All Operational</span></div>
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
            <div className="health-row"><span className="d down" /><b>API :4000</b><span className="hv">unreachable</span></div>
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