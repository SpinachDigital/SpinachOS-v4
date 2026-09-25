import './globals.css';
import { type ReactNode } from 'react';
import AppShell from '@/components/shell/AppShell';

export const metadata = {
  title: 'Spinach Labs — Command Center',
  description: 'AI Company HQ — Unified Command Center & 3D Office',
  icons: {
    icon: '/favicon.ico',
    apple: '/brand/icon/spinach-labs-mark.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" className="antialiased">
      <head>
        {/* Satoshi via Fontshare (Indian Type Foundry license); Inter var is the fallback */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700,900,1,2&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}