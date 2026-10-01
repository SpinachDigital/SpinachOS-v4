'use client';

/*
 * OutputPreview — Sprint 7 "Approvals that show the work".
 * Sprint 1 ka OutputCard (tasks/[id]/page.tsx) pattern, generalized for
 * approval payloads: post renders like a post (avatar row, body, char count,
 * copy), image renders, file downloads, link opens. Never a raw JSON dump.
 * Honest states: missing/unknown payload → visible note, no invention.
 */
import { useCallback, useState } from 'react';

type Shape =
  | { kind: 'text'; body: string; platform?: string }
  | { kind: 'image'; url: string; alt?: string }
  | { kind: 'link'; url: string }
  | { kind: 'file'; name: string; url?: string; note?: string }
  | { kind: 'unknown' };

const PLATFORM_LABEL: Record<string, string> = {
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  meta_ads: 'Meta Ads',
  google_ads: 'Google Ads',
  instagram: 'Instagram',
  whatsapp: 'WhatsApp',
};

function pick(payload: any): Shape {
  if (payload == null) return { kind: 'unknown' };
  if (typeof payload === 'string') {
    const s = payload.trim();
    if (/^https?:\/\/\S+\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?$/i.test(s)) return { kind: 'image', url: s };
    if (/^https?:\/\/\S+$/i.test(s)) return { kind: 'link', url: s };
    return { kind: 'text', body: s };
  }
  if (typeof payload === 'object') {
    const text = typeof payload.text === 'string' ? payload.text
      : typeof payload.body === 'string' ? payload.body : null;
    const url = typeof payload.url === 'string' ? payload.url : null;
    const file = typeof payload.file_path === 'string' ? payload.file_path
      : typeof payload.file === 'string' ? payload.file : null;
    const platform = typeof payload.platform === 'string' ? payload.platform : undefined;
    if (url && /\.(png|jpe?g|gif|webp|avif|svg)(\?\S*)?$/i.test(url)) return { kind: 'image', url, alt: text || undefined };
    if (file) return { kind: 'file', name: file.split(/[\\/]/).pop() || file, url, note: text || undefined };
    if (url) return { kind: 'link', url };
    if (text) return { kind: 'text', body: text, platform };
    // object with data (e.g. step_outputs) — stringify is honest fallback
    return { kind: 'unknown' };
  }
  return { kind: 'unknown' };
}

export function OutputPreview({ payload, agent, kind, title }: { payload: any; agent?: string; kind?: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  const shape = pick(payload);

  const copy = useCallback((body: string) => {
    navigator.clipboard?.writeText(body).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }, []);

  if (shape.kind === 'unknown') {
    return (
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'var(--bg-2, transparent)', border: '1px dashed var(--border-soft, #ccc)',
      }}>
        <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {payload == null
            ? 'No preview payload attached to this approval.'
            : `Preview not available for this payload shape (${typeof payload}${kind ? ` · ${kind}` : ''}).`}
        </p>
        {payload != null && (
          <pre className="t-mono" style={{ fontSize: 10, marginTop: 6, whiteSpace: 'pre-wrap', color: 'var(--text-dim)', maxHeight: 96, overflow: 'auto' }}>
            {JSON.stringify(payload, null, 2).slice(0, 600)}
          </pre>
        )}
      </div>
    );
  }

  if (shape.kind === 'image') {
    return (
      <div>
        <img
          src={shape.url}
          alt={shape.alt || title || 'deliverable'}
          style={{ maxWidth: '100%', borderRadius: 10, border: '1px solid var(--border-soft, #ccc)' }}
        />
        {shape.alt && <p className="t-meta" style={{ fontSize: 12, marginTop: 6, color: 'var(--text-dim)' }}>{shape.alt}</p>}
      </div>
    );
  }

  if (shape.kind === 'link') {
    return (
      <a
        href={shape.url}
        target="_blank"
        rel="noreferrer"
        className="t-meta"
        style={{ color: 'var(--green-bright, #4ade80)', wordBreak: 'break-all', fontSize: 13 }}
      >
        {shape.url}
      </a>
    );
  }

  if (shape.kind === 'file') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18 }}>📎</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="t-meta" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{shape.name}</p>
          {shape.note && <p className="t-meta" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{shape.note}</p>}
        </div>
        {shape.url ? (
          <a href={shape.url} download className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>Download</a>
        ) : (
          <span className="t-mono" style={{ fontSize: 10, color: 'var(--text-faint)' }}>no URL</span>
        )}
      </div>
    );
  }

  // text — renders like a social post, not a JSON dump
  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, fontSize: 12, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--green-dim, rgba(76,175,80,0.15))', color: 'var(--green-bright, #4ade80)', fontWeight: 700,
        }}>
          {(agent || 'SD').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="t-meta" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
            {agent ? `@${agent}` : 'Spinach Digital'}
            {shape.platform && (
              <span className="t-mono" style={{ fontSize: 9.5, color: 'var(--text-faint)', fontWeight: 400 }}>
                {' · '}{PLATFORM_LABEL[shape.platform] || shape.platform}
              </span>
            )}
          </div>
          <div className="t-mono" style={{ fontSize: 9.5, color: 'var(--text-faint)' }}>
            {shape.body.length.toLocaleString('en-IN')} chars
          </div>
        </div>
      </div>
      <p className="t-meta" style={{ fontSize: 13, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text)' }}>{shape.body}</p>
      <div className="flex items-center gap-2" style={{ marginTop: 12 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => copy(shape.kind === 'text' ? shape.body : '')}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

export default OutputPreview;
