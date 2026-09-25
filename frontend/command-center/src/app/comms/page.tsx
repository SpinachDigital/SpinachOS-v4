'use client';

// Comms page — internal team chat (Slack-style)
// Channels sidebar + message thread + composer
// Data: /api/v1/comms/* on :4000; real-time via WS 'message' events
import { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiFetch } from '@/lib/auth';

interface Channel {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  channel_type: string;
}

interface Message {
  id: string;
  channel_id?: string;
  thread_id?: string;
  sender_type: string;
  sender_id: string;
  content: string;
  message_type: string;
  created_at: string;
}

const SENDER_COLORS: Record<string, string> = {
  director: '#C9A86A',
  system: '#6366F1',
  ceo: '#A78BFA',
  cto: '#60A5FA',
  orchestrator: '#FBBF24',
  research: '#818CF8',
  social: '#F472B6',
  sales: '#FB923C',
  content: '#818CF8',
  design: '#22D3EE',
  engineering: '#34D399',
  ops: '#FBBF24',
  human: '#C9A86A',
};

export default function CommsPage() {
  const { connected } = useWebSocket();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch channels on mount
  const fetchChannels = useCallback(async () => {
    try {
      const res = await apiFetch('http://localhost:4000/api/v1/comms/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        if (data.length > 0 && !activeChannel) {
          setActiveChannel(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to fetch channels:', e);
    } finally {
      setLoading(false);
    }
  }, [activeChannel]);

  // Fetch messages when channel changes
  const fetchMessages = useCallback(async (channelId: string) => {
    try {
      const res = await apiFetch(`http://localhost:4000/api/v1/comms/messages?channel_id=${channelId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeChannel) {
      fetchMessages(activeChannel.id);
    }
  }, [activeChannel, fetchMessages]);

  // Real-time: WS message events
  useEffect(() => {
    if (!activeChannel) return;
    const handler = (e: MessageEvent) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.event === 'message' && msg.data?.channel_id === activeChannel.id) {
          setMessages((m) => [...m, msg.data as Message]);
        }
      } catch {}
    };
    const ws = new WebSocket('ws://localhost:4000/ws');
    ws.onmessage = handler;
    return () => ws.close();
  }, [activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || !activeChannel || sending) return;
    setSending(true);
    setInput('');
    // Optimistic add
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      channel_id: activeChannel.id,
      sender_type: 'human',
      sender_id: 'director',
      content,
      message_type: 'text',
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await apiFetch('http://localhost:4000/api/v1/comms/messages', {
        method: 'POST',
        body: JSON.stringify({
          channel_id: activeChannel.id,
          sender_type: 'human',
          sender_id: 'director',
          content,
        }),
      });
      if (!res.ok) throw new Error('send failed');
      const saved = await res.json();
      // Replace optimistic with saved
      setMessages((m) => m.map((msg) => (msg.id === optimistic.id ? saved : msg)));
    } catch (e) {
      console.error('Send failed:', e);
      // Mark failed
      setMessages((m) => m.map((msg) => (msg.id === optimistic.id ? { ...msg, content: `${msg.content} ⚠ (not delivered)` } : msg)));
    } finally {
      setSending(false);
    }
  };

  // Extract @mentions from content
  const parseMentions = (content: string) => {
    const parts = content.split(/(@[a-zA-Z0-9_-]+)/g);
    return parts.map((part, i) =>
      part.startsWith('@') ? (
        <span key={i} style={{ color: '#56883E', fontWeight: 600 }}>{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  // Design-system tokens (dark-first): all glass.* usages now resolve to the shared theme.
  const glass = {
    bg: 'var(--bg-page)',
    border: 'var(--border-soft)',
    text: 'var(--ink)',
    text2: 'var(--ink-3)',
    text3: 'var(--ink-4)',
  };

  return (
    <div className="flex h-full" style={{ background: '#0A0A0A' }}>
      {/* ============ CHANNELS SIDEBAR ============ */}
      <div className="flex flex-col shrink-0" style={{ width: 220, background: '#0E0E0E', borderRight: `1px solid ${glass.border}` }}>
        <div className="px-4 py-3.5" style={{ borderBottom: `1px solid ${glass.border}` }}>
          <div className="t-label" style={{ color: glass.text2 }}>Channels</div>
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`dot ${connected ? 'dot-green dot-pulse' : 'dot-red'}`} style={{ width: 6, height: 6 }} />
            <span className="t-mono" style={{ fontSize: 10, color: glass.text3 }}>{connected ? 'live' : 'offline'}</span>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="t-meta px-2 py-2" style={{ color: glass.text3, fontSize: 11 }}>Loading…</p>
          ) : channels.length === 0 ? (
            <div className="px-2 py-2">
              <p className="t-meta" style={{ color: glass.text3, fontSize: 11 }}>No channels yet</p>
              <button
                onClick={async () => {
                  await apiFetch('http://localhost:4000/api/v1/comms/seed', { method: 'POST' });
                  fetchChannels();
                }}
                className="t-meta mt-2 px-2 py-1 rounded border"
                style={{ color: '#56883E', borderColor: 'rgba(86,136,62,0.4)', fontSize: 11, cursor: 'pointer', background: 'transparent' }}
              >
                Seed defaults
              </button>
            </div>
          ) : (
            channels.map((ch) => {
              const isActive = activeChannel?.id === ch.id;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md mb-0.5 transition-colors"
                  style={{
                    background: isActive ? 'rgba(86,136,62,0.12)' : 'transparent',
                    cursor: 'pointer',
                    border: 'none',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  title={ch.description}
                >
                  <span className="block truncate" style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 500, color: isActive ? '#F7F6F1' : 'rgba(255,255,255,0.7)' }}>
                    {ch.display_name || `#${ch.name}`}
                  </span>
                </button>
              );
            })
          )}
        </nav>
      </div>

      {/* ============ MESSAGE THREAD ============ */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Channel header */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${glass.border}` }}>
          <div className="min-w-0">
            <div className="t-title truncate" style={{ color: glass.text, fontSize: 15 }}>
              {activeChannel ? activeChannel.display_name || `#${activeChannel.name}` : 'Select a channel'}
            </div>
            {activeChannel?.description && (
              <div className="t-meta truncate" style={{ color: glass.text3, fontSize: 11 }}>{activeChannel.description}</div>
            )}
          </div>
          <span className="t-mono shrink-0" style={{ fontSize: 10, color: glass.text3 }}>
            {messages.length} messages
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full" style={{ color: glass.text3 }}>
              <div className="t-meta mb-1">No messages yet</div>
              <div className="t-meta" style={{ fontSize: 11 }}>Say hello — agents in this channel will see it</div>
            </div>
          ) : (
            messages.map((msg) => {
              const color = SENDER_COLORS[msg.sender_id] || SENDER_COLORS[msg.sender_type] || '#9CA3AF';
              return (
                <div key={msg.id} className="flex items-start gap-3 mb-3.5">
                  <div
                    className="flex items-center justify-center rounded-lg shrink-0"
                    style={{ width: 30, height: 30, background: `${color}22`, border: `1px solid ${color}44` }}
                  >
                    <span style={{ fontSize: 10.5, fontWeight: 700, color }}>{msg.sender_id.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span style={{ fontSize: 12, fontWeight: 600, color }}>{msg.sender_id}</span>
                      {msg.sender_type === 'agent' && (
                        <span className="px-1 py-0 rounded" style={{ fontSize: 8.5, color: '#56883E', background: 'rgba(86,136,62,0.15)' }}>AGENT</span>
                      )}
                      {msg.sender_type === 'system' && (
                        <span className="px-1 py-0 rounded" style={{ fontSize: 8.5, color: '#6366F1', background: 'rgba(99,102,241,0.15)' }}>SYSTEM</span>
                      )}
                      <span className="t-mono" style={{ fontSize: 9, color: glass.text3 }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="t-meta mt-0.5" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 1.55 }}>
                      {parseMentions(msg.content)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer */}
        <div className="px-5 pb-5 shrink-0">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: '#141414', border: `1px solid ${glass.border}` }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void send(); }}
              placeholder={activeChannel ? `Message ${activeChannel.display_name || activeChannel.name}… use @name to mention` : 'Select a channel first'}
              className="t-meta flex-1"
              style={{ background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.9)' }}
            />
            <button
              onClick={() => void send()}
              disabled={sending || !input.trim() || !activeChannel}
              className="flex items-center justify-center rounded-lg shrink-0"
              style={{
                width: 30, height: 30,
                background: input.trim() && activeChannel ? '#56883E' : 'rgba(255,255,255,0.05)',
                cursor: input.trim() && activeChannel ? 'pointer' : 'default',
                border: 'none',
              }}
              aria-label="Send message"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round">
                <path d="m5 12 14 0M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}