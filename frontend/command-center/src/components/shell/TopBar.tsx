'use client';

// TopBar — reference .topbar: greeting + ⚡ command bar (input, mic, send) + icons + user chip + date card.
// Theme button dispatches office-theme for the 3D rig (day/night).
import { useEffect, useRef, useState } from 'react';

export default function TopBar({ onHamburger }: { onHamburger?: () => void }) {
  const [greeting, setGreeting] = useState('Good evening');
  const [light, setLight] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [cmd, setCmd] = useState('');
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setGreeting(h(now) < 12 ? 'Good morning' : h(now) < 17 ? 'Good afternoon' : 'Good evening');
      setDateStr(now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
      setTimeStr(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase());
    };
    const h = (d: Date) => d.getHours();
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // ⌘K focuses the command input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Restore persisted theme + push to 3D rig
  useEffect(() => {
    try {
      const saved = localStorage.getItem('office_light');
      if (saved === '1') {
        setLight(true);
        window.dispatchEvent(new CustomEvent('office-theme', { detail: { light: true } }));
      }
    } catch { /* noop */ }
  }, []);

  const toggleTheme = () => {
    const next = !light;
    setLight(next);
    window.dispatchEvent(new CustomEvent('office-theme', { detail: { light: next } }));
    try { localStorage.setItem('office_light', next ? '1' : '0'); } catch { /* noop */ }
  };

  const send = async () => {
    const text = cmd.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { getAuthToken } = await import('@/lib/auth');
      const token = await getAuthToken();
      await fetch('/api/v1/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ command: text, source: 'topbar' }),
      });
      setCmd('');
    } catch { /* office offline */ }
    finally { setSending(false); }
  };

  return (
    <header className="topbar">
      <button
        className="hamburger"
        type="button"
        aria-label="Open navigation"
        onClick={onHamburger}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="greeting">
        <h1>{greeting}, Abhishek 👋</h1>
        <p>Let&rsquo;s build a brighter tomorrow.</p>
      </div>
      <div className="command-wrap">
        <div className="command-bar">
          <span className="bolt">⚡</span>
          <input
            ref={inputRef}
            value={cmd}
            onChange={(e) => setCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder="Tell the office what to do…"
            aria-label="Command the office"
            autoComplete="off"
          />
          <button className="mic" title="Voice (Hermes)" aria-label="voice" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
            </svg>
          </button>
          <button className="send" onClick={send} aria-label="send" type="button" disabled={sending}>➤</button>
        </div>
      </div>
      <div className="topbar-icons">
        <button className="icon-btn" onClick={toggleTheme} title="Day / evening 3D" type="button">◐</button>
        <button className="icon-btn" title="Notifications" type="button">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.3 21a2 2 0 0 0 3.4 0" />
          </svg>
          <span className="ping" />
        </button>
        <div className="user-chip">
          <div className="avatar">AJ</div>
          <div className="who">
            <b>Abhishek Jha</b>
            <span>Founder</span>
          </div>
        </div>
        <div className="date-card">
          <div>
            <div className="d1">{dateStr}</div>
            <div className="d2">{timeStr}</div>
            <div className="d3">Mumbai, India</div>
          </div>
        </div>
      </div>
    </header>
  );
}