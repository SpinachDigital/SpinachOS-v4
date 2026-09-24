'use client';

// CommandGateway: floating voice + text pill — talk to the office
// Text: sends to API :4000 /api/v1/command (fallback: /command)
// Voice: Web Speech API (webkitSpeechRecognition) with live transcript
import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '@/lib/auth';

interface GatewayResponse {
  ok?: boolean;
  reply?: string;
  message?: string;
  error?: string;
  action?: string;
}

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
};

export default function CommandGateway() {
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [input, setInput] = useState('');
  const [log, setLog] = useState<Array<{ role: 'you' | 'office'; text: string; time: string }>>([]);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [log]);

  const send = async (text: string, source: 'text' | 'voice' = 'text') => {
    const command = text.trim();
    if (!command || busy) return;
    setBusy(true);
    setLog((l) => [...l, { role: 'you', text: `${source === 'voice' ? '🎙 ' : ''}${command}`, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');
    setTranscript('');

    try {
      let data: GatewayResponse | null = null;
      for (const url of ['http://localhost:4000/api/v1/command', 'http://localhost:4000/command']) {
        try {
          const res = await apiFetch(url, {
            method: 'POST',
            body: JSON.stringify({ command, source, timestamp: new Date().toISOString() }),
          });
          if (res.ok) {
            data = await res.json();
            break;
          }
        } catch {
          continue;
        }
      }
      const reply =
        data?.reply ||
        data?.message ||
        (data?.action ? `Running: ${data.action}` : null) ||
        'Office is offline (API :4000 not reachable) — command logged, will run when it\'s back.';
      setLog((l) => [...l, { role: 'office', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } catch {
      setLog((l) => [...l, { role: 'office', text: 'Gateway error — command logged.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleMic = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setLog((l) => [...l, { role: 'office', text: 'Voice not supported in this browser — use text.', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let final = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) final += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(final || interim);
      if (final) {
        setListening(false);
        void send(final, 'voice');
      }
    };    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <>
      {/* Floating pill (bottom-center of 3D stage) */}
      <div className="absolute z-30 flex justify-center" style={{ bottom: 20, left: 0, right: 0 }}>
        <div
          className="flex items-center gap-2 px-2 py-2 animate-rise"
          style={{
            borderRadius: 999,
            background: 'rgba(15,15,15,0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          }}
        >
          {/* Mic button */}
          <button
            onClick={toggleMic}
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 38, height: 38,
              background: listening ? '#B94A3E' : '#56883E',
              cursor: 'pointer',
              border: 'none',
              animation: listening ? 'micPulse 1.2s ease-in-out infinite' : 'none',
            }}
            aria-label={listening ? 'Stop listening' : 'Speak to the office'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4" />
            </svg>
          </button>

          {/* Text input */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void send(input); }}
            placeholder={listening ? 'Listening…' : 'Tell the office what to do…'}
            className="t-meta"
            style={{
              width: 'min(340px, 56vw)',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'rgba(255,255,255,0.9)',
            }}
          />

          {/* Send */}
          <button
            onClick={() => void send(input)}
            disabled={busy || !input.trim()}
            className="flex items-center justify-center rounded-full shrink-0"
            style={{
              width: 34, height: 34,
              background: input.trim() ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
              cursor: input.trim() ? 'pointer' : 'default',
              border: 'none',
            }}
            aria-label="Send command"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round">
              <path d="m5 12 14 0M13 5l7 7-7 7" />
            </svg>
          </button>

          {/* History toggle */}
          <button
            onClick={() => setOpen((v) => !v)}
            className="t-mono shrink-0"
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,0.5)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '0 8px',
            }}
          >
            {open ? 'hide' : log.length > 0 ? `${log.length}` : 'log'}
          </button>
        </div>
      </div>

      {/* Voice transcript bubble */}
      {listening && transcript && (
        <div
          className="absolute z-30 animate-rise"
          style={{
            bottom: 76, left: 0, right: 0,
            display: 'flex', justifyContent: 'center', pointerEvents: 'none',
          }}
        >
          <div
            className="t-meta"
            style={{
              padding: '8px 16px',
              borderRadius: 12,
              background: 'rgba(185,74,62,0.9)',
              color: '#fff',
              maxWidth: 420,
            }}
          >
            {transcript}
          </div>
        </div>
      )}

      {/* Conversation log panel */}
      {open && (
        <div
          className="absolute z-30 animate-rise"
          style={{
            bottom: 76, left: '50%', transform: 'translateX(-50%)',
            width: 'min(420px, 90vw)',
            maxHeight: 300,
            borderRadius: 14,
            background: 'rgba(15,15,15,0.92)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            overflowY: 'auto',
            padding: 12,
          }}
        >
          <div className="t-label" style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Command Log</div>
          {log.length === 0 ? (
            <p className="t-meta" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
              No commands yet — try "start a pipeline for Gym in Mira Road" or "show pending approvals".
            </p>
          ) : (
            log.map((entry, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div className="flex items-baseline gap-2">
                  <span
                    className="t-label"
                    style={{ color: entry.role === 'you' ? '#7BA55E' : '#C9A86A', fontSize: 9 }}
                  >
                    {entry.role === 'you' ? 'YOU' : 'OFFICE'}
                  </span>
                  <span className="t-mono" style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>{entry.time}</span>
                </div>
                <p className="t-meta" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 2 }}>
                  {entry.text}
                </p>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}

      <style jsx global>{`
        @keyframes micPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(185, 74, 62, 0.5); }
          50% { box-shadow: 0 0 0 8px rgba(185, 74, 62, 0); }
        }
      `}</style>
    </>
  );
}