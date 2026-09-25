'use client';

// Command Center — full reference dashboard (spinach-os.html) rebuilt on real data:
// 5 stat cards → REFERENCE 3D office (procedural: slogan wall, skylights, staff, trees)
// with projected dept tags → Live Activity / Jobs / Projects / Assets
// → Progress / Outputs / Calendar / Quote. Live WS feed + TaskRunsPanel output viewer.
import { useEffect, useMemo, useState } from 'react';
import { buildWsUrl } from '@/lib/auth';
import dynamic from 'next/dynamic';

import TaskRunsPanel from '@/components/TaskRunsPanel';
import { useSpinachStore } from '@/store/spinach-store';

// The extracted reference office — procedural 141-component scene from spinach-os.html
const ReferenceOffice = dynamic(() => import('@/components/three/ReferenceOffice'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <div style={{ color: 'var(--green-bright)', fontSize: 13, marginBottom: 14, fontFamily: 'JetBrains Mono, monospace' }}>Building office…</div>
        <div style={{ width: 180, height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.08)', margin: '0 auto', overflow: 'hidden' }}>
          <div style={{ width: '40%', height: '100%', background: 'var(--green)', borderRadius: 999 }} />
        </div>
      </div>
    </div>
  ),
});

type Stat = { key: string; label: string; num: number | string; delta?: string; flat?: boolean };
type FeedItem = { agent: string; action: string; detail?: string; when: string };
type Job = { id: string; title: string; agent: string; status: string; when: string };
type Proj = { id: string; name: string; client: string; pct: number };

const HUES = [145, 160, 175, 190, 205, 130, 115, 220];
const ASSET_FALLBACK = ['Brand Kit', 'Deck v1', 'Logo Suite', 'Palette', 'Type Scale', 'Guidelines'];
const OUTPUT_FALLBACK = ['Post copy', 'SEO brief', 'Logo SVG', 'Deck page'];

export default function CommandCenter() {
  const [stats, setStats] = useState<Stat[]>([]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [projects, setProjects] = useState<Proj[]>([]);
  const [assetCount, setAssetCount] = useState(0);
  const [outputCount, setOutputCount] = useState(0);
  const [activeZone, setActiveZone] = useState<string | null>(null);
  const [showRuns, setShowRuns] = useState(false);

  const { connected, agentStates } = useSpinachStore();
  const handleWsEvent = useSpinachStore((s) => s.handleWsEvent);
  const setWsConnected = useSpinachStore((s) => s.setWsConnected);
  const agentList = Object.entries(agentStates);
  const workingCount = agentList.filter(([, s]) => s.state === 'working' || s.state === 'thinking').length;
  // Phase 2: loading + loud-error states (no silent mock fallback)
  const [apiError, setApiError] = useState<string | null>(null);
  const [loadedOnce, setLoadedOnce] = useState(false);

  // ---- initial load: all bridge endpoints ----
  // Phase 2 Task 4: no silent mock fallback — API failures surface LOUDLY
  // (the auth fix re-mints on 401, so only real outages reach this state).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [s, a, j, p, as, o] = await Promise.all([
          fetch('/api/overview/stats').then(r => (r.ok ? r.json() : null)),
          fetch('/api/activity?limit=15').then(r => (r.ok ? r.json() : null)),
          fetch('/api/jobs?limit=6').then(r => (r.ok ? r.json() : null)),
          fetch('/api/projects').then(r => (r.ok ? r.json() : null)),
          fetch('/api/assets').then(r => (r.ok ? r.json() : null)),
          fetch('/api/outputs').then(r => (r.ok ? r.json() : null)),
        ]);
        if (!alive) return;
        // All-null = the API is unreachable (every call failed) → loud error state
        if (s === null && a === null && j === null) {
          setApiError('API :4000 unreachable — panels are offline. Check scripts/start-all.ps1 or run the watchdog (runs every 5 min).');
          setLoadedOnce(true);
          return;
        }
        setApiError(null);
        setLoadedOnce(true);
        // stats: [{label, value, icon, delta}] — map label→our keys
        if (Array.isArray(s)) {
          const byLabel: Record<string, any> = {};
          s.forEach((x: any) => { byLabel[x.label] = x; });
          setStats([
            { key: 'clients', label: 'Active Clients', num: byLabel['Active Clients']?.value ?? 0, delta: byLabel['Active Clients']?.delta || '—' },
            { key: 'running', label: 'Agents Working', num: byLabel['Tasks Running']?.value ?? workingCount, delta: byLabel['Tasks Running']?.delta || '—' },
            { key: 'pipelines', label: 'Active Pipelines', num: byLabel['Pipelines']?.value ?? 0, delta: byLabel['Pipelines']?.delta || '—' },
            { key: 'assets', label: 'Agents Online', num: byLabel['Agents Online']?.value ?? 0, delta: byLabel['Agents Online']?.delta || '—' },
            { key: 'approvals', label: 'Pending Approvals', num: byLabel['Pending Approvals']?.value ?? 0, delta: byLabel['Pending Approvals']?.delta || (byLabel['Pending Approvals']?.value ? 'needs you' : 'clear') },
          ]);
        }
        // activity: raw array [{id, icon, title, sub, time}]
        if (Array.isArray(a)) {
          setFeed(a.map((x: any) => ({
            agent: String(x.title || '').replace(/<[^>]+>/g, '').split(' — ')[0] || 'office',
            action: String(x.title || '').replace(/<[^>]+>/g, '').split(' — ')[1] || '',
            detail: x.sub || '',
            when: x.time || 'now',
          })));
        }
        // jobs: raw array [{icon, title, sub, status, meta}]
        if (Array.isArray(j)) {
          setJobs(j.map((x: any, i: number) => ({
            id: x.id || `j${i}`,
            title: String(x.title || '').slice(0, 60),
            agent: x.sub || '',
            status: x.status || 'completed',
            when: x.meta || '',
          })));
        }
        // projects: raw array [{name, pct}]
        if (Array.isArray(p)) {
          setProjects(p.map((x: any, i: number) => ({
            id: `p${i}`,
            name: String(x.name || '').split(' #')[0],
            client: '',
            pct: x.pct ?? 0,
          })));
        }
        if (Array.isArray(as)) setAssetCount(as.length);
        if (Array.isArray(o)) setOutputCount(o.length);
        setApiError(null);
        setLoadedOnce(true);
      } catch {
        // Phase 2 Task 4: real outage → loud, not silent mock fallback
        setApiError('API :4000 unreachable — panels are offline. Check scripts/start-all.ps1 or run the watchdog (runs every 5 min).');
        setLoadedOnce(true);
      }
    })();
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- live WS connection → store ----
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const connect = () => {
      if (closed) return;
      try { ws = new WebSocket(buildWsUrl('/ws')); } catch { retry = setTimeout(connect, 5000); return; }
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.event) handleWsEvent(msg.event, msg.data);
          if (msg.event === 'feed' || msg.event === 'activity') {
            const d = msg.data ?? {};
            setFeed(prev => [{ agent: d.agent ?? 'office', action: d.action ?? 'update', detail: d.detail ?? d.message ?? '', when: 'now' }, ...prev].slice(0, 20));
          }
        } catch { /* malformed */ }
      };
      ws.onclose = () => { setWsConnected(false); if (!closed) retry = setTimeout(connect, 5000); };
      ws.onerror = () => { try { ws?.close(); } catch { /* noop */ } };
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      try { ws?.close(); } catch { /* noop */ }
    };
  }, [handleWsEvent, setWsConnected]);

  const cal = useMemo(() => buildCalendar(), []);

  return (
    <>
      {/* ============ STATS ============ */}
      {apiError && (
        <div className="panel" style={{ borderColor: 'var(--red)', background: 'rgba(239, 68, 68, 0.06)', padding: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--red)', fontWeight: 600 }}>
            <span className="d down" /> {apiError}
          </div>
        </div>
      )}
      <section className="stats">
        {(stats.length ? stats : FALLBACK_STATS).map(s => (
          <div className="stat-card" key={s.key}>
            <div className="top">
              <div className="num">{s.num}</div>
              <div className="ic">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  {ICONS[s.key]}
                </svg>
              </div>
            </div>
            <div className="lbl">{s.label}</div>
            <div className={`delta${s.flat ? ' flat' : ''}`}>{s.delta ?? '—'}</div>
          </div>
        ))}
      </section>

      {/* ============ 3D VIEWPORT (reference procedural office) ============ */}
      <section className="viewport-card" id="viewport">
        <ReferenceOffice onDeptClick={(id) => setActiveZone(activeZone === id ? null : id)} />
        {/* agent-state chip overlays the projected tags (tags themselves render inside ReferenceOffice) */}
        <div className="viewport-tags" style={{ pointerEvents: 'none' }}>
          {activeZone && agentStates[activeZone] && (
            <div
              className="dept-tag active"
              style={{ left: '50%', top: '12%', transform: 'translate(-50%,-50%)', pointerEvents: 'auto' }}
            >
              <span className="dot" />
              {activeZone.toUpperCase()}
              <span className="sub">{agentStates[activeZone].state} — {agentStates[activeZone].activity || 'idle'}</span>
            </div>
          )}
        </div>
        <div className="viewport-hud tl">
          <div className="hud-chip"><span className={connected ? 'live-dot' : ''} /> {connected ? 'LIVE' : 'OFFLINE'}</div>
          <div className="hud-chip">{workingCount} working</div>
        </div>
        <style jsx>{`
          .viewport-hud.tl { flex-direction: column; align-items: flex-start; gap: 6px; }
        `}</style>
        <div className="viewport-hud tr">
          <button className="hud-btn" type="button" onClick={() => setShowRuns(true)}>Task Runs</button>
        </div>
        <div className="viewport-hint">drag to orbit · scroll to zoom · click a department</div>
      </section>

      {/* ============ MID ROW ============ */}
      <section className="mid-row">
        <div className="panel">
          <div className="panel-head"><h3><span className="live-dot" /> Live Activity</h3></div>
          <div className="feed">
            {!loadedOnce && feed.length === 0 && (
              <>
                {[0, 1, 2].map(i => (
                  <div key={i} className="feed-item" style={{ opacity: 0.5 }}>
                    <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 10 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 12, width: '50%', marginBottom: 5 }} />
                      <div className="skeleton" style={{ height: 10, width: '70%' }} />
                    </div>
                  </div>
                ))}
              </>
            )}
            {loadedOnce && feed.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>Quiet office. Run a command above.</div>}
            {feed.map((f, i) => (
              <div className="feed-item" key={i}>
                <div className={`feed-ic${f.agent === 'director' ? '' : ' green'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4M8 4h8" />
                  </svg>
                </div>
                <div className="txt">
                  <b>{f.agent}</b> {f.action}
                  {f.detail && <span>{f.detail}</span>}
                </div>
                <div className="time">{f.when}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Recent Jobs</h3><button className="link" type="button">View All</button></div>
          <div>
            {!loadedOnce && jobs.length === 0 && (
              <>
                {[0, 1, 2].map(i => (
                  <div key={i} className="job" style={{ opacity: 0.5 }}>
                    <div className="skeleton" style={{ width: 30, height: 30, borderRadius: 10 }} />
                    <div style={{ flex: 1 }}>
                      <div className="skeleton" style={{ height: 12, width: '60%', marginBottom: 5 }} />
                      <div className="skeleton" style={{ height: 10, width: '40%' }} />
                    </div>
                  </div>
                ))}
              </>
            )}
            {loadedOnce && jobs.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No jobs yet — the first command will appear here.</div>}
            {jobs.map(j => (
              <div className="job" key={j.id}>
                <div className="job-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
                  </svg>
                </div>
                <div className="jt">
                  <b>{j.title}</b>
                  <span>{j.agent}</span>
                </div>
                <div className="when">
                  <span className={`pill ${pillFor(j.status)}`}>{j.status}</span>
                  <small>{j.when}</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Projects</h3><button className="link" type="button">View All</button></div>
          <div>
            {projects.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No active projects.</div>}
            {projects.map(p => (
              <div className="proj" key={p.id}>
                <div className="pr">
                  <b>{p.name}</b>
                  <span>{p.client} · {p.pct}%</span>
                </div>
                <div className="bar"><i style={{ width: `${p.pct}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Assets</h3><button className="link" type="button">View All</button></div>
          <div className="asset-tabs">
            <button className="asset-tab active" type="button">All</button>
            <button className="asset-tab" type="button">Logos</button>
            <button className="asset-tab" type="button">Decks</button>
            <button className="asset-tab" type="button">Social</button>
          </div>
          <div className="asset-grid">
            {ASSET_FALLBACK.map((n, i) => (
              <div className="asset-card" key={n}>
                <div className="asset-thumb" style={{ background: `hsl(${HUES[i]} 32% 22%)` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 3 3 3-3 3 3" />
                  </svg>
                </div>
                <div className="am"><b>{n}</b><span>{assetCount ? 'library' : 'template'}</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ BOTTOM STRIP ============ */}
      <section className="bottom-strip">
        <div className="panel">
          <div className="panel-head"><h3>Project Progress</h3><button className="link" type="button">View All</button></div>
          <div>
            {projects.map(p => (
              <div className="proj" key={p.id}>
                <div className="pr">
                  <b>{p.name}</b>
                  <span>{p.pct}%</span>
                </div>
                <div className="bar"><i style={{ width: `${p.pct}%` }} /></div>
              </div>
            ))}
            {projects.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No projects in flight.</div>}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>Recent Outputs</h3><button className="link" type="button">View All</button></div>
          <div className="output-grid">
            {OUTPUT_FALLBACK.map((n, i) => (
              <div className="output-card" key={n} onClick={() => setShowRuns(true)}>
                <div className="output-thumb" style={{ background: `hsl(${HUES[i + 2]} 30% 20%)` }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                  </svg>
                </div>
                <div className="om"><b>{n}</b><span>{outputCount ? 'recent' : 'awaiting first run'}</span></div>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h3>{cal.title}</h3><button className="link" type="button">‹ ›</button></div>
          <table className="cal">
            <thead>
              <tr><th>M</th><th>T</th><th>W</th><th>T</th><th>F</th><th>S</th><th>S</th></tr>
            </thead>
            <tbody>
              {cal.weeks.map((w, wi) => (
                <tr key={wi}>
                  {w.map((d, di) => (
                    <td key={di} className={d.today ? 'today' : d.dim ? 'dim' : ''}>{d.day || ''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="panel quote-card">
          <blockquote>&ldquo;Same people.<br />Higher possibilities.<span className="dot"> ●</span>&rdquo;</blockquote>
          <div className="qdash" />
        </div>
      </section>


      {/* ============ TASK RUNS DRAWER ============ */}
      {showRuns && <TaskRunsPanel onClose={() => setShowRuns(false)} />}
    </>
  );
}

/* ---------- helpers ---------- */

const FALLBACK_STATS: Stat[] = [
  { key: 'clients', label: 'Active Clients', num: '—', flat: true },
  { key: 'running', label: 'Agents Working', num: '—', flat: true },
  { key: 'pipelines', label: 'Active Pipelines', num: '—', flat: true },
  { key: 'assets', label: 'Brand Assets', num: '—', flat: true },
  { key: 'approvals', label: 'Pending Approvals', num: '—', flat: true },
];

const ICONS: Record<string, React.ReactNode> = {
  clients: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  running: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />,
  pipelines: <><path d="M4 20V10M10 20V4M16 20v-8" /><path d="M2 20h20" /></>,
  assets: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 18 5-5 3 3 3-3 3 3" /></>,
  approvals: <><path d="M9 12l2 2 4-4" /><rect x="3" y="5" width="18" height="14" rx="3" /></>,
};

function pillFor(status: string) {
  if (status === 'done' || status === 'completed') return 'completed';
  if (status === 'running') return 'running';
  if (status === 'failed' || status === 'blocked') return 'failed';
  return 'completed';
}

function buildCalendar() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const first = new Date(y, m, 1);
  const startOff = (first.getDay() + 6) % 7; // Monday-first
  const daysIn = new Date(y, m + 1, 0).getDate();
  const cells: { day: number | null; today: boolean; dim: boolean }[] = [];
  for (let i = 0; i < startOff; i++) cells.push({ day: null, today: false, dim: true });
  for (let d = 1; d <= daysIn; d++) cells.push({ day: d, today: d === now.getDate(), dim: false });
  while (cells.length % 7 !== 0) cells.push({ day: null, today: false, dim: true });
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return {
    title: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    weeks,
  };
}