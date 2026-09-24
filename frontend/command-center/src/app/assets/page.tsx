'use client';

import PlaceholderPage from '@/components/PlaceholderPage';

export default function AssetsPage() {
  return (
    <PlaceholderPage
      title="Assets"
      sub="Brand & library"
      description="Brand asset library — logos, fonts, design tokens, generated visuals. Brand assets are already self-hosted in /brand and /fonts."
      links={[{ href: '/settings', label: 'Workspace Settings' }]}
    />
  );
}
