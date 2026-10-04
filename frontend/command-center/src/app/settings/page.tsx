'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';

interface Integration {
  id: string;
  name: string;
  connected: boolean;
  config?: Record<string, any>;
  lastSync?: string;
}

interface Profile {
  id: string;
  name: string;
  model?: string;
  fallback_model?: string;
  provider?: string;
  status?: string;
  dormant?: boolean;
}

type Tab = 'integrations' | 'models' | 'knowledge' | 'theme' | 'api' | 'advanced';

// The 10 Hermes profile keys known from the execution bridge (bridge.ts).
// Used only to mark which profiles the API does NOT report — never as fake rows.
const KNOWN_PROFILE_KEYS = [
  'ceo', 'cto', 'orchestrator', 'designer', 'engineer',
  'social', 'seo_specialist', 'research', 'sales', 'ads_manager',
];

const TABS: { id: Tab; label: string }[] = [
  { id: 'integrations', label: 'Integrations' },
  { id: 'models', label: 'Models & Brains' },
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'theme', label: 'Theme' },
  { id: 'api', label: 'API Keys' },
  { id: 'advanced', label: 'Advanced' },
];

export default function SettingsPage() {
  const { connected } = useWebSocket();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('integrations');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState<string | null>(null);
  // Models & Brains live telemetry (P1 endpoints)
  const [breakers, setBreakers] = useState<any[] | null>(null);
  const [fallbackLog, setFallbackLog] = useState<any[] | null>(null);

  useEffect(() => {
    setIntegrations([
      { id: 'supabase', name: 'Supabase', connected: true, lastSync: new Date().toISOString() },
      { id: 'hermes', name: 'Hermes Gateway', connected: true, lastSync: new Date().toISOString() },
      { id: 'telegram', name: 'Telegram Bot', connected: false },
      { id: 'postiz', name: 'Postiz', connected: false },
      { id: 'twitter', name: 'X/Twitter', connected: false },
      { id: 'linkedin', name: 'LinkedIn', connected: false },
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeTab !== 'models' || profiles.length > 0) return;
    setProfilesLoading(true);
    setProfilesError(null);
    apiFetch('/api/v1/profiles')
      .then(async (res) => {
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        setProfiles(Array.isArray(data) ? data : []);
      })
      .catch((e: any) => setProfilesError(e?.message || 'Failed to load profiles'))
      .finally(() => setProfilesLoading(false));
  }, [activeTab, profiles.length]);

  // P1: breaker + fallback telemetry (loaded when the Models tab opens)
  useEffect(() => {
    if (activeTab !== 'models') return;
    apiFetch('/api/v1/models/breakers')
      .then(async (res) => { setBreakers(res.ok ? await res.json() : []); })
      .catch(() => setBreakers([]));
    apiFetch('/api/v1/models/fallback-log')
      .then(async (res) => { setFallbackLog(res.ok ? await res.json() : []); })
      .catch(() => setFallbackLog([]));
  }, [activeTab]);

  const reportedIds = new Set(profiles.map((p) => p.id));
  const unreported = KNOWN_PROFILE_KEYS.filter((k) => !reportedIds.has(k));

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Integrations, models, appearance, and advanced options</p>
        </div>
        <div className="actions">
          <span className="live-badge">
            <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <div style={{ padding: '12px 24px 0' }}>
        <div className="chip-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`chip-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div className="skeleton" style={{ height: 200 }} />
        ) : activeTab === 'integrations' ? (
          <>
            <div className="section-title">Integrations</div>
            <div className="grid-2">
              {integrations.map((int) => (
                <div key={int.id} className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="agent-ic"><span className="t-mono">{int.id.slice(0, 2).toUpperCase()}</span></div>
                    <div>
                      <div className="t-heading">{int.name}</div>
                      {int.lastSync && (
                        <div className="t-meta" style={{ color: 'var(--text-faint)' }}>
                          Last sync: {new Date(int.lastSync).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className={`dot ${int.connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
                    {/* Sprint 10 P1: dead button fixed — these integrations are
                        infra status (Supabase/gateway = live by wiring), and the
                        not-connected ones (Telegram/Postiz/X/LinkedIn) have no
                        setup flow in this UI yet. Honest state: the button says
                        what it does instead of silently doing nothing. */}
                    {int.connected ? (
                      <span className="t-meta" style={{ color: 'var(--text-faint)' }}>wired</span>
                    ) : (
                      <span className="t-meta" style={{ color: 'var(--text-faint)' }}>not set up</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : activeTab === 'models' ? (
          <>
            <div className="section-title">Models & Brains</div>

            <div className="panel">
              <div className="panel-head">
                <h3>Agent models</h3>
                <span className="badge badge-gray">GET /api/v1/profiles</span>
              </div>
              {profilesLoading ? (
                <div className="skeleton" style={{ height: 120 }} />
              ) : profilesError ? (
                <div className="t-meta" style={{ color: 'var(--red)' }}>
                  Couldn't load profiles: {profilesError}
                </div>
              ) : profiles.length === 0 ? (
                <div className="t-meta" style={{ color: 'var(--text-faint)' }}>No profiles reported.</div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr><th>Profile</th><th>Primary model</th><th>Fallback model</th><th>Provider</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {profiles.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="cell-main">{p.name || p.id}</span>
                            <div className="cell-dim t-mono">{p.id}</div>
                          </td>
                          <td className="t-mono">{p.model || '—'}</td>
                          <td className="t-mono">{p.fallback_model || '—'}</td>
                          <td className="t-mono">{p.provider || '—'}</td>
                          <td>
                            {p.dormant
                              ? <span className="pill draft">dormant</span>
                              : p.status === 'live' || p.status === 'running'
                                ? <span className="pill approved">{p.status}</span>
                                : <span className="pill pending">{p.status || 'unknown'}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {unreported.length > 0 && (
                <div className="info-note" style={{ marginTop: 12 }}>
                  The API currently reports {profiles.length} of {KNOWN_PROFILE_KEYS.length} known profiles.
                  Not reported (live in the Hermes runtime, not the API):{' '}
                  <span className="t-mono">{unreported.join(', ')}</span>
                </div>
              )}
            </div>

            <div className="grid-2" style={{ alignItems: 'start' }}>
              <div className="panel">
                <div className="panel-head">
                  <h3>Circuit breaker</h3>
                  <span className="badge badge-gray">GET /api/v1/models/breakers</span>
                </div>
                {breakers === null ? (
                  <div className="skeleton" style={{ height: 100 }} />
                ) : breakers.length === 0 ? (
                  <div className="t-meta" style={{ color: 'var(--text-faint)', padding: '10px 0' }}>
                    No gateway calls recorded yet this session — breaker rows appear after the
                    first outbound LLM call (or its failure).
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr><th>Provider</th><th>State</th><th>Consec. fails</th><th>Total fails</th><th>Last failure</th><th>Opened</th></tr></thead>
                      <tbody>
                        {breakers.map((b) => (
                          <tr key={b.provider}>
                            <td className="t-mono">{b.provider}</td>
                            <td>
                              {b.state === 'closed'
                                ? <span className="pill approved">closed</span>
                                : b.state === 'half-open'
                                  ? <span className="pill pending">half-open</span>
                                  : <span className="pill rejected">OPEN</span>}
                            </td>
                            <td>{b.consecutive_failures ?? 0}</td>
                            <td>{b.total_failures ?? 0}</td>
                            <td className="cell-dim">{b.last_failure_at ? new Date(b.last_failure_at).toLocaleString() : '—'}</td>
                            <td className="cell-dim">{b.opened_at ? new Date(b.opened_at).toLocaleString() : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="info-note" style={{ marginTop: 12 }}>
                  3 consecutive failures open a provider for 15 min; one probe call re-closes it.
                </div>
              </div>
              <div className="panel">
                <div className="panel-head">
                  <h3>Fallback event log</h3>
                  <span className="badge badge-gray">GET /api/v1/models/fallback-log</span>
                </div>
                {fallbackLog === null ? (
                  <div className="skeleton" style={{ height: 100 }} />
                ) : fallbackLog.length === 0 ? (
                  <div className="t-meta" style={{ color: 'var(--text-faint)', padding: '10px 0' }}>
                    No fallbacks triggered this session — every agent is running on its primary path.
                  </div>
                ) : (
                  <div className="kv" style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {fallbackLog.map((f, i) => (
                      <div key={i} className="kv-row" style={{ alignItems: 'flex-start' }}>
                        <span className="k t-mono" style={{ maxWidth: '45%' }}>
                          {f.from} → {f.to}
                        </span>
                        <span className="v" style={{ fontWeight: 400, textAlign: 'left', maxWidth: '55%' }}>
                          {f.reason}
                          <div className="t-meta" style={{ color: 'var(--text-faint)', fontSize: 11, marginTop: 2 }}>
                            {f.timestamp ? new Date(f.timestamp).toLocaleString() : ''}
                          </div>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="alert-note">
              <b>Ads Manager is dormant by design</b> — it auto-activates when a Scale/Growth
              client is onboarded. All other profiles are live.
            </div>
          </>
        ) : activeTab === 'knowledge' ? (
          <KnowledgePanel />
        ) : activeTab === 'theme' ? (
          <>
            <div className="section-title">Appearance</div>
            <div className="grid-2">
              <div className="panel">
                <div className="panel-head"><h3>Theme</h3><span className={`dot ${theme === 'dark' ? 'dot-green dot-pulse' : 'dot-red'}`} /></div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['dark', 'light'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => { setTheme(t); window.dispatchEvent(new CustomEvent('office-theme', { detail: t })); }}
                      className={`btn ${theme === t ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ flex: 1, justifyContent: 'center' }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><h3>Font scale</h3></div>
                <input type="range" min={0.8} max={1.3} step={0.05} defaultValue={1} style={{ width: '100%' }} />
              </div>
              <div className="panel">
                <div className="panel-head"><h3>Motion</h3></div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" style={{ width: 16, height: 16 }} />
                  Reduce animations
                </label>
              </div>
            </div>
          </>
        ) : activeTab === 'api' ? (
          <>
            <div className="section-title">API keys</div>
            <p className="t-meta" style={{ color: 'var(--text-dim)' }}>
              Keys are stored in the Hermes vault (never in this UI). Manage them via Settings → Passwords &amp; Logins.
            </p>
            <div className="grid-2">
              {['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'JWT_SECRET', 'TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].map((key) => (
                <div key={key} className="panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span className="t-mono" style={{ fontSize: 11 }}>{key}</span>
                    <span className="t-meta" style={{ color: apiKeys[key] ? 'var(--green-bright)' : 'var(--text-faint)' }}>
                      {apiKeys[key] ? 'Configured' : 'Not set'}
                    </span>
                  </div>
                  <input
                    type="password"
                    placeholder={apiKeys[key] ? '••••••••' : 'Enter key…'}
                    className="input"
                    onChange={(e) => setApiKeys({ ...apiKeys, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="section-title">Advanced</div>
            <div className="panel" style={{ marginBottom: 14 }}>
              <div className="panel-head"><h3>Database</h3></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm">Run Migrations</button>
                <button className="btn btn-secondary btn-sm">Seed Defaults</button>
                <button className="btn btn-danger btn-sm">Reset DB (danger)</button>
              </div>
            </div>
            <div className="panel" style={{ marginBottom: 14 }}>
              <div className="panel-head"><h3>Debug</h3></div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm">View WS Log</button>
                <button className="btn btn-secondary btn-sm">Export Audit Log</button>
                <button className="btn btn-secondary btn-sm">Clear Cache</button>
              </div>
            </div>
            <div className="panel">
              <div className="panel-head"><h3>Version</h3></div>
              <div className="t-meta" style={{ color: 'var(--text-dim)' }}>
                Spinach OS v4 · Next.js 14 · Three.js r186 · Hermes Agent
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/*
 * KnowledgePanel — Phase 5 GOAL 7b: the ingest UI (no more API-only
 * ingestion) + a live query tester. Founder pastes text (or client docs
 * summaries), picks client + kind, ingests — the chunk is embedded + indexed
 * via the real /api/v1/knowledge/ingest. Query tester hits the REAL
 * retrieval endpoint (hybrid, client-isolated) so quality is visible.
 */
function KnowledgePanel() {
  const [ingText, setIngText] = useState('');
  const [ingTitle, setIngTitle] = useState('');
  const [ingKind, setIngKind] = useState('pattern');
  const [ingClientId, setIngClientId] = useState('');
  const [ingesting, setIngesting] = useState(false);
  const [ingResult, setIngResult] = useState<string | null>(null);

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [qText, setQText] = useState('');
  const [qClientId, setQClientId] = useState('');
  const [qResults, setQResults] = useState<any[] | null>(null);
  const [querying, setQuerying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/v1/clients');
        if (res.ok) setClients(await res.json());
      } catch { /* honest empty */ }
    })();
  }, []);

  const ingest = async () => {
    if (!ingText.trim()) return;
    setIngesting(true);
    setIngResult(null);
    try {
      const res = await apiFetch('/api/v1/knowledge/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: ingTitle.trim() || ingText.trim().slice(0, 60),
          content: ingText.trim(),
          kind: ingKind,
          client_id: ingClientId || null,
        }),
      });
      const body = res.ok ? await res.json().catch(() => ({})) : { error: `HTTP ${res.status}` };
      setIngResult(res.ok && body.ok !== false
        ? `Ingested ✓ (embedded ${body.embedded !== false ? '+ indexed' : '— lexical-only, embedding failed'})`
        : (body.error || 'Ingest failed'));
      if (res.ok) { setIngText(''); setIngTitle(''); }
    } catch (e: any) {
      setIngResult(e?.message || 'Ingest failed');
    } finally {
      setIngesting(false);
    }
  };

  const runQuery = async () => {
    if (!qText.trim()) return;
    setQuerying(true);
    try {
      const params = new URLSearchParams({ q: qText.trim(), limit: '5' });
      if (qClientId) params.set('client_id', qClientId);
      const res = await apiFetch(`/api/v1/knowledge/query?${params.toString()}`);
      const body = res.ok ? await res.json().catch(() => ({})) : { error: `HTTP ${res.status}` };
      setQResults(body.results || body.chunks || []);
    } catch {
      setQResults([]);
    } finally {
      setQuerying(false);
    }
  };

  return (
    <>
      <div className="section-title">Knowledge — ingest</div>
      <div className="panel" style={{ marginBottom: 14 }}>
        <div className="panel-head">
          <h3>Ingest a document / note</h3>
          <span className="badge badge-gray">POST /api/v1/knowledge/ingest</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <input
            value={ingTitle}
            onChange={(e) => setIngTitle(e.target.value)}
            placeholder="Title (optional)"
            className="input"
            style={{ flex: 2, minWidth: 160 }}
          />
          <select value={ingKind} onChange={(e) => setIngKind(e.target.value)} className="input" style={{ flex: 1, minWidth: 120 }}>
            {['pattern', 'preference', 'decision', 'client', 'guideline', 'report'].map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={ingClientId} onChange={(e) => setIngClientId(e.target.value)} className="input" style={{ flex: 1, minWidth: 140 }}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <textarea
          value={ingText}
          onChange={(e) => setIngText(e.target.value)}
          placeholder="Paste the text to ingest (brand guidelines, meeting notes, competitor intel…). It gets embedded (NVIDIA) + indexed for hybrid retrieval."
          className="input"
          rows={5}
          style={{ width: '100%', marginBottom: 10, resize: 'vertical' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => void ingest()} disabled={ingesting || !ingText.trim()} className="btn btn-primary btn-sm" style={{ minHeight: 44 }}>
            {ingesting ? 'Ingesting…' : 'Ingest'}
          </button>
          {ingResult && <span className="t-meta" style={{ color: ingResult.includes('✓') ? 'var(--green-bright)' : 'var(--red)' }}>{ingResult}</span>}
        </div>
      </div>

      <div className="section-title">Knowledge — query tester</div>
      <div className="panel">
        <div className="panel-head">
          <h3>Test hybrid retrieval</h3>
          <span className="badge badge-gray">GET /api/v1/knowledge/query</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
          <input
            value={qText}
            onChange={(e) => setQText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void runQuery(); }}
            placeholder="Query (e.g. 'which clients have no logo')"
            className="input"
            style={{ flex: 3, minWidth: 200 }}
          />
          <select value={qClientId} onChange={(e) => setQClientId(e.target.value)} className="input" style={{ flex: 1, minWidth: 140 }}>
            <option value="">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={() => void runQuery()} disabled={querying || !qText.trim()} className="btn btn-secondary btn-sm" style={{ minHeight: 44 }}>
            {querying ? 'Searching…' : 'Query'}
          </button>
        </div>
        {qResults === null ? null : qResults.length === 0 ? (
          <div className="t-meta" style={{ color: 'var(--text-faint)', padding: '8px 0' }}>No results — honest empty state.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {qResults.map((r, i) => (
              <div key={r.id || i} className="panel" style={{ padding: 10, marginBottom: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span className="badge badge-gray">#{i + 1}</span>
                  <span className="t-heading" style={{ fontSize: 13 }}>{r.title || '(untitled)'}</span>
                  {r.kind && <span className="t-meta">{r.kind}</span>}
                  {typeof r.score === 'number' && <span className="t-meta" style={{ marginLeft: 'auto' }}>score {r.score.toFixed?.(3) || r.score}</span>}
                </div>
                <div className="t-meta" style={{ marginTop: 4, color: 'var(--text-faint)' }}>{String(r.content || '').slice(0, 160)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
