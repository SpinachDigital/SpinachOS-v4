// Shared zone → department-page map for the 3D office (N4.21).
// Single source of truth: page.tsx (deep-links + legend) and
// components/office/ZonePanel.tsx both import from here.

export const ZONE_ROUTES: Record<string, { href: string; label: string }> = {
  'ceo-cabin': { href: '/approvals', label: 'Approvals' },
  marketing: { href: '/grow', label: 'Grow' },
  engineering: { href: '/agents', label: 'Agent Fleet' },
  design: { href: '/assets', label: 'Assets' },
  operations: { href: '/pipeline', label: 'Pipelines' },
  clients: { href: '/leads', label: 'Leads' },
  'research-cabin': { href: '/chat', label: 'Office Chat' },
};
