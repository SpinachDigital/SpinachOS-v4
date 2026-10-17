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
  email: 'Email',
  threads: 'Threads',
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
    // Sprint 9 §2: outreach draft shape { kind:'outreach', channel, subject, body }
    // renders like a message — subject bold + body pre-wrap. Not a JSON dump.
    if (payload.kind === 'outreach' && typeof payload.body === 'string') {
      return {
        kind: 'text',
        body: (payload.subject ? `${payload.subject}\n\n` : '') + payload.body,
        platform: typeof payload.channel === 'string' ? payload.channel : undefined,
      } as any;
    }
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
    // R1.1 lead_qualified: { kind, model, score, rationale, options } — show the
    // score + the agent's rationale in words. Never "Details unavailable".
    if (payload.kind === 'lead_qualified' || (payload.score != null && payload.rationale)) {
      const bits: string[] = [];
      if (payload.score != null) bits.push(`Score ${payload.score}/100`);
      // QA pass (2026-10-16): humanize the model name — raw slugs like
      // "claude-opus-4-6-thinking" read like internals. Strip provider
      // prefixes and hyphens → "Opus 4.6".
      if (payload.model) {
        const human = String(payload.model)
          .replace(/^.*\//, '')
          .replace(/-(?:thinking|preview|latest|high|low)$/i, '')
          .replace(/claude-(\w+?)-(\d+)-(\d+)/i, (_m, fam: string, maj: string, min: string) => `${fam[0].toUpperCase()}${fam.slice(1)} ${maj}.${min}`)
          .replace(/nemotron-([\d.]+)[a-z-]*/i, 'Nemotron $1')
          .replace(/gemini-([\d.]+)-flash/i, 'Gemini $1 Flash')
          .replace(/gpt-oss-(\d+)b/i, 'GPT-OSS $1B')
          .replace(/-/g, ' ');
        bits.push(`assessed with ${human}`);
      }
      const opts = Array.isArray(payload.options) && payload.options.length
        ? `\n\nNext-step options:\n${payload.options.map((o: any, i: number) => `${i + 1}. ${typeof o === 'string' ? o : (o.label || o.action || JSON.stringify(o))}`).join('\n')}`
        : '';
      const body = `${bits.join(' · ')}${payload.rationale ? `\n\n${payload.rationale}` : ''}${opts}`;
      if (body.trim()) return { kind: 'text', body } as any;
    }
    // R1.1 stuck_stage / gate: what's stuck, how long, what unblocks it.
    if (payload.stage || payload.pipeline_name) {
      const idle = payload.idle_hours != null ? `${payload.idle_hours}h idle` : null;
      const sla = payload.sla_hours != null ? `SLA ${payload.sla_hours}h` : null;
      const head = [payload.client_name, payload.pipeline_name ? `"${payload.pipeline_name}"` : null].filter(Boolean).join(' · ');
      const body = [head, payload.stage ? `Stuck at stage: ${payload.stage}` : null, [idle, sla].filter(Boolean).join(' · ')]
        .filter(Boolean).join('\n');
      return { kind: 'text', body } as any;
    }
    // R1.1 grow_draft / publish_failure: show the actual failure, not a dead end.
    // R3: strip raw HTML from error bodies (a Publora 404 once rendered a full
    // <!DOCTYPE html> block inside a card — internals leak).
    if (payload.error || payload.kind === 'grow_draft' || payload.kind === 'publish_failure') {
      const clean = (s: string) => s
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s*Cannot POST \S*/, ' (endpoint not found)')
        .trim()
        .slice(0, 200);
      const body = typeof payload.error === 'string'
        ? `Publish failed: ${clean(payload.error)}` || 'Publish failed — open the item to retry.'
        : 'Draft could not be published — open the item to retry.';
      return { kind: 'text', body } as any;
    }
    // R1.1 last resort for object payloads: show the real fields, labeled —
    // never a dead end, never a JSON dump.
    const pairs = Object.entries(payload)
      .filter(([, v]) => v != null && typeof v !== 'object')
      .slice(0, 6)
      .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v).slice(0, 140)}`);
    if (pairs.length) return { kind: 'text', body: pairs.join('\n') } as any;
    // object with data (e.g. step_outputs) we can't render — the caller
    // shows a human fallback, never a JSON dump.
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
    // Human fallback only — never a raw JSON dump, never the word
    // "undefined". The founder sees a note, not internals.
    return (
      <div style={{
        padding: '10px 12px', borderRadius: 10,
        background: 'var(--bg-2, transparent)', border: '1px dashed var(--border-soft, #ccc)',
      }}>
        <p className="t-meta" style={{ fontSize: 12, color: 'var(--text-faint)' }}>
          {payload == null
            ? 'No details attached to this approval.'
            : 'Details unavailable for this approval type.'}
        </p>
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
            {shape.body.length.toLocaleString('en-IN')}{' '}characters
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
