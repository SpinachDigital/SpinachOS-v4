'use client';

import PlaceholderPage from '@/components/PlaceholderPage';

export default function TeamPage() {
  return (
    <PlaceholderPage
      title="Team"
      sub="People & roles"
      description="Human team directory and agent-to-human role mapping. Agent roster lives in AI Agents."
      links={[{ href: '/agents', label: 'View AI Agents' }]}
    />
  );
}
