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
  status?: string;
}

type Tab = 'integrations' | 'models' | 'theme' | 'api' | 'advanced';

// The 10 Hermes profile keys known from the execution bridge (bridge.ts).
// Used only to mark which profiles the API does NOT report — never as fake rows.
const KNOWN_PROFILE_KEYS = [
  'ceo', 'cto', 'orchestrator', 'designer', 'engineer',
  'social', 'seo_specialist', 'research', 'sales', 'ads_manager',
];

const TABS: { id: Tab; label: string }[] = [
  { id: 'integrations', label: 'Integrations' },
  { id: 'models', label: 'Models & Brains' },
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
                    <button className="btn btn-secondary btn-sm" onClick={() => {}}>
                      {int.connected ? 'Disconnect' : 'Configure'}
                    </button>
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
                      <tr><th>Profile</th><th>Primary model</th><th>Fallback</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {profiles.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span className="cell-main">{p.name || p.id}</span>
                            <div className="cell-dim t-mono">{p.id}</div>
                          </td>
                          <td className="t-mono">{p.model || '—'}</td>
                          <td><span className="cell-dim">Not exposed by API</span></td>
                          <td>
                            {p.status === 'running'
                              ? <span className="pill approved">running</span>
                              : <span className="pill draft">{p.status || 'unknown'}</span>}
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
                <div className="panel-head"><h3>Circuit breaker</h3></div>
                <div className="empty-state" style={{ padding: '28px 20px' }}>
                  <h3>No breaker telemetry</h3>
                  <p>The API doesn't expose circuit-breaker state yet. Per-provider failure counts and open/half-open status will appear here once the backend adds the endpoint.</p>
                  <span className="tag">backend gap</span>
                </div>
              </div>
              <div className="panel">
                <div className="panel-head"><h3>Fallback event log</h3></div>
                <div className="empty-state" style={{ padding: '28px 20px' }}>
                  <h3>No fallback events</h3>
                  <p>Model fallback switches (primary → fallback) will be listed here with timestamps once the backend emits them.</p>
                  <span className="tag">backend gap</span>
                </div>
              </div>
            </div>

            <div className="alert-note">
              <b>Heads up:</b> the profiles endpoint currently serves hardcoded data
              (all "running", all on one model). Treat statuses as provisional until the
              backend wires it to the live Hermes runtime.
            </div>
          </>
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
