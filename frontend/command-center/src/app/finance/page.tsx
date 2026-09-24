'use client';

import PlaceholderPage from '@/components/PlaceholderPage';

export default function FinancePage() {
  return (
    <PlaceholderPage
      title="Finance"
      sub="Revenue & costs"
      description="Revenue tracking per client, agent compute costs, and margin analysis. Will connect to the leads pipeline (closed_won) for revenue attribution."
      links={[{ href: '/analytics', label: 'View Analytics' }]}
    />
  );
}
