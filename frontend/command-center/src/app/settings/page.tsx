'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';

interface Integration {
  id: string;
  name: string;
  connected: boolean;
  config?: Record<string, any>;
  lastSync?: string;
}

export default function SettingsPage() {
  const { connected } = useWebSocket();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'integrations' | 'theme' | 'api' | 'advanced'>('integrations');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load from localStorage / API
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

  const glass = {
    bg: 'rgba(15,15,15,0.78)',
    border: 'rgba(255,255,255,0.08)',
    text: 'rgba(255,255,255,0.85)',
    text2: 'rgba(255,255,255,0.45)',
    text3: 'rgba(255,255,255,0.3)',
  };

  return (
    <div className="flex flex-col h-full" style={{ background: glass.bg }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: glass.border }}>
        <div>
          <h1 className="t-title" style={{ color: glass.text }}>Settings</h1>
          <p className="t-meta mt-0.5" style={{ color: glass.text2 }}>
            Configure integrations, appearance, and advanced options
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} />
          <span className="t-mono" style={{ color: glass.text2, fontSize: 12 }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-5 py-2 border-b" style={{ borderColor: glass.border }}>
        {(['integrations', 'theme', 'api', 'advanced'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${activeTab === tab ? 'font-medium' : ''}`}
            style={{
              background: activeTab === tab ? 'rgba(86,136,62,0.2)' : glass.bg,
              borderColor: activeTab === tab ? '#56883E' : glass.border,
              color: glass.text,
              border: '1px solid',
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center h-64" style={{ color: glass.text2 }}>
            <div className="t-mono">Loading…</div>
          </div>
        ) : activeTab === 'integrations' ? (
          <div className="space-y-4">
            <h2 className="t-label" style={{ color: glass.text }}>Integrations</h2>
            {integrations.map(int => (
              <div
                key={int.id}
                className="flex items-center justify-between p-4 rounded-xl"
                style={{ background: glass.bg, border: `1px solid ${glass.border}` }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 40, height: 40, background: int.connected ? 'rgba(86,136,62,0.15)' : 'rgba(255,255,255,0.05)' }}
                  >
                    <span className="t-mono" style={{ fontSize: 14, color: int.connected ? '#56883E' : glass.text3 }}>{int.id.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="t-label" style={{ color: glass.text }}>{int.name}</div>
                    {int.lastSync && (
                      <div className="t-meta" style={{ color: glass.text2, fontSize: 11 }}>
                        Last sync: {new Date(int.lastSync).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`dot ${int.connected ? 'dot-green dot-pulse' : 'dot-red'}`}
                  />
                  <button
                    className="px-3 py-1.5 text-sm rounded-lg border transition-colors"
                    style={{
                      background: glass.bg,
                      borderColor: glass.border,
                      color: glass.text,
                      cursor: 'pointer',
                    }}
                    onClick={() => {}}
                  >
                    {int.connected ? 'Disconnect' : 'Configure'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'theme' ? (
          <div className="space-y-6">
            <h2 className="t-label" style={{ color: glass.text }}>Appearance</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="t-label" style={{ color: glass.text }}>Theme</span>
                  <span className={`dot ${theme === 'dark' ? 'dot-green dot-pulse' : 'dot-red'}`} />
                </div>
                <div className="flex gap-3">
                  {(['dark', 'light'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => { setTheme(t); window.dispatchEvent(new CustomEvent('office-theme', { detail: t })); }}
                      className={`flex-1 py-3 rounded-lg transition-colors ${theme === t ? 'font-medium' : ''}`}
                      style={{
                        background: theme === t ? 'rgba(86,136,62,0.2)' : glass.bg,
                        borderColor: theme === t ? '#56883E' : glass.border,
                        color: glass.text,
                        border: '1px solid',
                      }}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
                <div className="t-label mb-3" style={{ color: glass.text }}>Font Scale</div>
                <input type="range" min="0.8" max="1.3" step="0.05" value="1" className="w-full" />
              </div>
              <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
                <div className="t-label mb-3" style={{ color: glass.text }}>Reduced Motion</div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-spinach-500" />
                  <span className="t-meta" style={{ color: glass.text }}>Disable animations</span>
                </label>
              </div>
            </div>
          </div>
        ) : activeTab === 'api' ? (
          <div className="space-y-6">
            <h2 className="t-label" style={{ color: glass.text }}>API Keys</h2>
            <p className="t-meta" style={{ color: glass.text2 }}>
              Keys are stored in Hermes vault (never in this UI). Manage them via Settings → Passwords & Logins.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              {['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'JWT_SECRET', 'TELEGRAM_BOT_TOKEN', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY'].map(key => (
                <div key={key} className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="t-mono" style={{ fontSize: 11, color: glass.text }}>{key}</span>
                    <span className="t-meta" style={{ color: apiKeys[key] ? '#56883E' : glass.text3 }}>
                      {apiKeys[key] ? 'Configured' : 'Not set'}
                    </span>
                  </div>
                  <input
                    type="password"
                    placeholder={apiKeys[key] ? '••••••••' : 'Enter key…'}
                    className="w-full px-3 py-2 rounded-lg border transition-colors"
                    style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}
                    onChange={e => setApiKeys({ ...apiKeys, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <h2 className="t-label" style={{ color: glass.text }}>Advanced</h2>
            <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
              <h3 className="t-label mb-3" style={{ color: glass.text }}>Database</h3>
              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 rounded-lg border transition-colors" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>Run Migrations</button>
                <button className="px-4 py-2 rounded-lg border transition-colors" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>Seed Defaults</button>
                <button className="px-4 py-2 rounded-lg border transition-colors" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#EF4444' }}>Reset DB (danger)</button>
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
              <h3 className="t-label mb-3" style={{ color: glass.text }}>Debug</h3>
              <div className="flex flex-wrap gap-3">
                <button className="px-4 py-2 rounded-lg border transition-colors" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>View WS Log</button>
                <button className="px-4 py-2 rounded-lg border transition-colors" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>Export Audit Log</button>
                <button className="px-4 py-2 rounded-lg border transition-colors" style={{ background: glass.bg, borderColor: glass.border, color: glass.text }}>Clear Cache</button>
              </div>
            </div>
            <div className="p-4 rounded-xl" style={{ background: glass.bg, border: `1px solid ${glass.border}` }}>
              <h3 className="t-label mb-3" style={{ color: glass.text }}>Version</h3>
              <div className="t-meta" style={{ color: glass.text2 }}>
                Spinach OS v4 • Next.js 14 • Three.js r186 • Hermes Agent
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}