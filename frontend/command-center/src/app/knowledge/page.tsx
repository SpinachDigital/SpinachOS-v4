'use client';

import PlaceholderPage from '@/components/PlaceholderPage';

export default function KnowledgePage() {
  return (
    <PlaceholderPage
      title="Knowledge"
      sub="Docs & SOPs"
      description="SOPs, runbooks, and brand documentation. System context lives in CONTEXT.md at the repo root."
      links={[{ href: '/logs', label: 'Activity Logs' }, { href: '/settings', label: 'Settings' }]}
    />
  );
}
