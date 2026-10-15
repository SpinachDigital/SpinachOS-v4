'use client';

// PushToggle — N4.24 frontend: the founder opts this device into gate-event
// pushes (new approval, stuck stage, @founder mention). Uses the backend
// contract from the N4 report:
//   GET  /api/v1/push/vapid-key   → { public_key }
//   POST /api/v1/push/subscribe   (auth) { endpoint, keys:{p256dh,auth} }
//   POST /api/v1/push/unsubscribe (auth) { endpoint }
//   POST /api/v1/push/test        (auth)
// The service worker (public/push-sw.js) shows the notification.

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/auth';

const SW_PATH = '/push-sw.js';

type Status = 'checking' | 'unsupported' | 'denied' | 'off' | 'on' | 'busy' | 'error';

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64.replace(/-/g, '+').replace(/_/g, '/') + padding);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function keyToBase64(key: ArrayBuffer | null): string {
  if (!key) return '';
  const bytes = new Uint8Array(key);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export default function PushToggle() {
  const [status, setStatus] = useState<Status>('checking');
  const [note, setNote] = useState<string>('');

  const refresh = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      setStatus(sub ? 'on' : 'off');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const enable = async () => {
    setStatus('busy');
    setNote('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }
      const reg = await navigator.serviceWorker.register(SW_PATH);
      const keyRes = await apiFetch('/api/v1/push/vapid-key');
      if (!keyRes.ok) throw new Error('vapid-key failed');
      const { public_key } = await keyRes.json();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(public_key),
      });
      const body = {
        endpoint: sub.endpoint,
        keys: { p256dh: keyToBase64(sub.getKey('p256dh')), auth: keyToBase64(sub.getKey('auth')) },
      };
      const res = await apiFetch('/api/v1/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setStatus('on');
      setNote('This device will buzz on gate events.');
    } catch (e: any) {
      setStatus('error');
      setNote(e?.message || 'Could not enable push.');
    }
  };

  const disable = async () => {
    setStatus('busy');
    setNote('');
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      const endpoint = sub?.endpoint;
      await sub?.unsubscribe();
      if (endpoint) {
        await apiFetch('/api/v1/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        });
      }
      setStatus('off');
    } catch (e: any) {
      setStatus('error');
      setNote(e?.message || 'Could not disable push.');
    }
  };

  const sendTest = async () => {
    setStatus('busy');
    setNote('');
    try {
      const res = await apiFetch('/api/v1/push/test', { method: 'POST' });
      const data = await res.json();
      setNote(res.ok ? `Test sent: ${data.sent} delivered, ${data.failed} failed.` : 'Test failed.');
    } catch (e: any) {
      setNote(e?.message || 'Test failed.');
    } finally {
      refresh();
    }
  };

  if (status === 'checking') {
    return <div className="t-meta" style={{ fontSize: 13, color: 'var(--text-faint)' }}>Checking push support…</div>;
  }
  if (status === 'unsupported') {
    return <div className="t-meta" style={{ fontSize: 13, color: 'var(--text-faint)' }}>This browser does not support Web Push.</div>;
  }
  if (status === 'denied') {
    return <div className="t-meta" style={{ fontSize: 13, color: 'var(--text-faint)' }}>Notifications are blocked for this site. Allow them in the browser's site settings, then come back.</div>;
  }

  const on = status === 'on';
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={on ? disable : enable}
          disabled={status === 'busy'}
          style={{
            minHeight: 44, padding: '0 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
            background: on ? 'var(--border)' : 'var(--accent)', color: on ? 'var(--text)' : '#fff',
            fontSize: 13.5, fontWeight: 600, opacity: status === 'busy' ? 0.6 : 1,
          }}
        >
          {status === 'busy' ? 'Working…' : on ? 'Turn off push' : 'Turn on push'}
        </button>
        {on && (
          <button
            onClick={sendTest}
            style={{
              minHeight: 44, padding: '0 14px', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: 13, fontWeight: 600,
            }}
          >
            Send test
          </button>
        )}
        <span className="t-mono" style={{ fontSize: 11.5, color: on ? '#22c55e' : 'var(--text-faint)' }}>
          {on ? '● ON — this device' : '○ OFF'}
        </span>
      </div>
      <div className="t-meta" style={{ fontSize: 12.5, color: 'var(--text-faint)', marginTop: 10, maxWidth: 560 }}>
        Buzz-worthy only: a new approval lands, a pipeline stage goes stuck, or someone mentions @founder in office chat. Nothing else ever buzzes.
      </div>
      {note && <div className="t-meta" style={{ fontSize: 12.5, color: 'var(--text)', marginTop: 8 }}>{note}</div>}
      {status === 'error' && !note && (
        <div className="t-meta" style={{ fontSize: 12.5, color: '#ef4444', marginTop: 8 }}>Something went wrong. Try again.</div>
      )}
    </div>
  );
}
