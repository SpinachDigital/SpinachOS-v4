/*
 * src/dashboard-helpers.ts — Phase 3 monolith split (index.ts L3712–3733).
 * No behavior changes.
 */
export const AGENT_ICONS: Record<string, string> = {
  ceo: 'target', cto: 'gear', orchestrator: 'bolt', research: 'search',
  social: 'megaphone', engineering: 'gear', design: 'pen', sales: 'users',
  content: 'doc', ops: 'gear', marketing: 'megaphone', hr: 'users',
};
export const DEPT_TAG_DEFS = [
  { id: 'strategy', name: 'Strategy & Consulting' },
  { id: 'content', name: 'Content & Creative' },
  { id: 'campaigns', name: 'Campaigns & Media' },
  { id: 'webtech', name: 'Web & Tech' },
  { id: 'data', name: 'Data & Analytics' },
];

export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return s <= 5 ? 'now' : `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} mins ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hour${s >= 7200 ? 's' : ''} ago`;
  return `${Math.floor(s / 86400)} days ago`;
}

// Overview stats — 5 KPI cards
