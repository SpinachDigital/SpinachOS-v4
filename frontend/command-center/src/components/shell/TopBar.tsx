'use client';

// TopBar — greeting + THE canonical command bar (CommandGateway in the topbar
// slot — thread_id preserved, responses rendered, brainstorm flow works) +
// icons + user chip + date card. Theme button dispatches office-theme for
// the 3D rig (day/night).
// Phase 0: the old inline command implementation (raw fetch, thread_id
// dropped, response ignored) is DELETED — CommandGateway is the only bar.
import { useEffect, useState } from 'react';
import CommandGateway from './CommandGateway';

export default function TopBar({ onHamburger }: { onHamburger?: () => void }) {
  const [greeting, setGreeting] = useState('Good evening');
  const [light, setLight] = useState(false);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const hour = now.getHours();
      // Greeting by ACTUAL hour — 0–4 AM is "Good night" (the old <12 rule
      // said "Good morning" at 3 AM, which reads wrong to a founder up late).
      const g = hour < 4 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : hour < 21 ? 'Good evening' : 'Good night';
      setGreeting(g);
      setDateStr(now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }));
      setTimeStr(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).toUpperCase());
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  // ⌘K focuses the command input (dispatch an event — the gateway owns the input)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('spinach:focus-command'));
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
      {/* THE canonical command bar — CommandGateway (thread_id, responses,
          brainstorm, voice). Mounted in the topbar slot on every page. */}
      <div className="command-wrap">
        <CommandGateway inline />
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