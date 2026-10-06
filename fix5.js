const fs = require('fs');
const content = fs.readFileSync('frontend/command-center/src/components/chat/ChatCard.tsx', 'utf8');

const oldState = `export function ApprovalCard({ obj }: { obj: any }) {
  const [state, setState] = useState<any>(obj);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const isPending = state?.status === 'pending';`;

const newState = `export function ApprovalCard({ obj }: { obj: any }) {
  const [state, setState] = useState<any>(obj);
  const [busy, setBusy] = useState<'approve' | 'reject' | 'tighten' | null>(null);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const isPending = state?.status === 'pending';
  const styleScore = state?.style_score ?? null;
  const styleViolations = state?.style_violations ?? [];`;

let newContent = content.replace(oldState, newState);

const oldReturnPart = `return (
    <div style={{ ...CARD_SHELL, borderColor: isPending ? 'rgba(245,158,11,0.35)' : 'var(--border-hairline, #eee)' }}>
      <div className="flex items-start justify-between gap-2" style={{ marginBottom: 8 }}>
        <h4 className="t-meta" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', margin: 0, wordBreak: 'break-word' }}>{state.title}</h4>
        <Pill status={state.status} />
      </div>
      <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
        {state.type || 'approval'}
        {state.requested_by ? \` · requested by @${state.requested_by}\` : ''}
        {state.platform ? \` · ${state.platform}\` : ''}
      </p>`;

const newReturnPart = `return (
    <div style={{ ...CARD_SHELL, borderColor: isPending ? 'rgba(245,158,11,0.35)' : 'var(--border-hairline, #eee)' }}>
      <div className="flex items-start justify-between gap-2" style={{ marginBottom: 8 }}>
        <h4 className="t-meta" style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)', margin: 0, wordBreak: 'break-word' }}>{state.title}</h4>
        <Pill status={state.status} />
      </div>
      <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)', margin: 0 }}>
        {state.type || 'approval'}
        {state.requested_by ? \` · requested by @${state.requested_by}\` : ''}
        {state.platform ? \` · ${state.platform}\` : ''}
      </p>
      {/* Style score chip */}
      {styleScore !== null && (
        <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--bg-2, #fafaf7)', borderRadius: 8, border: '1px solid var(--border-soft, #eee)' }}>
          <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text)' }}>Style ${styleScore}/10</span>
          {styleViolations.length > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text-faint)', marginLeft: 8 }}>
              — ${styleViolations.length} violation(s): ${styleViolations.slice(0, 3).join(', ')}${styleViolations.length > 3 ? '...' : ''}
            </span>
          )}
          {styleScore < 6 && isPending && (
            <button
              onClick={async () => {
                setBusy('tighten');
                try {
                  const res = await apiFetch('/api/v1/evolutions/tighten', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: obj.payload_json?.output || '', violations: state.style_violations })
                  });
                  if (res.ok) {
                    const tightened = await res.json();
                    setState((s: any) => ({ ...s, payload_json: { ...s.payload_json, output: tightened.output }, style_score: tightened.score, style_violations: tightened.violations }));
                  }
                } catch {} finally { setBusy(null); }
              }}
              disabled={busy !== null}
              style={{ marginLeft: 8, padding: '4px 8px', minHeight: 32, borderRadius: 6, background: '#004B63', color: '#fff', fontSize: 11.5, fontWeight: 600, border: 'none', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              {busy === 'tighten' ? 'Tightening...' : 'Tighten'}
            </button>
          )}
        </div>
      )}`;

newContent = newContent.replace(oldState, newState);
newContent = newContent.replace(oldReturnPart, newReturnPart);

fs.writeFileSync('frontend/command-center/src/components/chat/ChatCard.tsx', newContent);
console.log('Done FIX 5');
