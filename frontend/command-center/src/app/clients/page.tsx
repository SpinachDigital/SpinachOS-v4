'use client';

import PlaceholderPage from '@/components/PlaceholderPage';

export default function ClientsPage() {
  return (
    <PlaceholderPage
      title="Clients"
      sub="Relationships"
      description="Client directory with pipeline status per client. Clients already exist in the database — this page will list them with their workflow progress."
      links={[{ href: '/approvals', label: 'View Approvals' }]}
    />
  );
}
