// Sprint 1: extractDeliverable — pull the actual deliverable text out of an
// agent run's raw terminal output. Hermes profile runs wrap the model's reply
// in banner noise + a final "╭─ ☤ Hermes ─...╮ DELIVERABLE ╰────╯" result
// panel. STRUCTURE (observed live, task 93757998):
//   Query: … / Initializing agent… / ⚠ warnings / ┊ tool-call trace
//   ╭─ ☤ Hermes ─────────╮
//   THE DELIVERABLE (model prose — what the founder wants)
//   ╰────────────────────╯
//   Resume this session with: … (session trailer)
// Priority: 1) text INSIDE the ☤ Hermes panel 2) else strip noise lines.
// Conservative: full raw output if nothing matches — never empty, no fake trim.

export type Deliverable = {
  kind: 'text' | 'image' | 'file' | 'link';
  title: string;
  body: string;
  extracted: boolean;
};

const TRAILER_RE = /^\s*(Resume this session with:|hermes --resume|hermes -c |Session:\s|Title:\s|Duration:\s|Messages:\s|⚠|Warning:|Model fallback:)/;

// ANSI escape codes (panels emit [0m, [38;2;R;G;Bm etc) must go before matching.
function stripAnsi(s: string): string {
  // two forms appear in stored outputs: real ESC bytes AND the literal
  // text form that some copies render as characters (backslash u 0 0 1 b).
  const esc = String.fromCharCode(27);
  s = s.split(esc).join('');
  s = s.split('\u001b').join('');
  // now the remaining [0m / [38;2;R;G;Bm style sequences
  s = s.replace(/\[[0-9;]*[A-Za-z]/g, '');
  return s;}

export function extractDeliverable(raw: unknown, taskTitle = ''): Deliverable {
  const text = stripAnsi(String(raw ?? '')).trim();
  const title = taskTitle.slice(0, 120);
  if (!text) {
    return { kind: 'text', title, body: '', extracted: false };
  }

  // Link deliverable? (single URL = the whole output)
  if (/^https?:\/\/\S+$/i.test(text)) {
    return { kind: 'link', title, body: text, extracted: true };
  }

  // Image? (profile runs that produced an image path)
  const imgMatch = text.match(/\.(png|jpe?g|webp|gif)\b/i);
  if (imgMatch && text.length < 500 && /(generated|saved|created|wrote|image)/i.test(text)) {
    return { kind: 'image', title, body: text, extracted: true };
  }

  // THE result panel: ╭─ ☤ Hermes ────╮ … ╰────╯ — the deliverable is INSIDE.
  const panelOpen = text.indexOf('╭─ ☤ Hermes');
  if (panelOpen >= 0) {
    const openEnd = text.indexOf('╮', panelOpen);
    const closeIdx = openEnd >= 0 ? text.indexOf('╰', openEnd) : -1;
    if (openEnd >= 0 && closeIdx > openEnd) {
      const inner = text.slice(openEnd + 1, closeIdx).trim();
      const firstLine = (inner.split(/\r?\n/)[0] || '').trim();
      if (inner.length > 0) {
        return {
          kind: 'text',
          title: firstLine.length <= 120 ? firstLine.slice(0, 120) : title,
          body: inner,
          extracted: true,
        };
      }
    }
  }

  // No panel: strip leading/trailing noise from the whole output
  const lines = text.split(/\r?\n/);
  const isNoise = (l: string) =>
    TRAILER_RE.test(l) || l.trim() === '' ||
    /^(Query:|Initializing agent|─+|┊|[+-]{3}|@@)/.test(l.trim());
  let start = 0;
  while (start < lines.length && isNoise(lines[start])) start++;
  let end = lines.length;
  while (end > start && isNoise(lines[end - 1])) end--;

  const body = lines.slice(start, end).join('\n').trim();

  // If stripping ate everything, keep the full raw output — honest, not empty.
  if (body.length < 40 && text.length > body.length) {
    return { kind: 'text', title, body: text, extracted: false };
  }

  return { kind: 'text', title, body, extracted: false };
}
