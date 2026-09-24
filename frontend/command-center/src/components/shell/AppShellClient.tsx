'use client';

import { type ReactNode, useState, useEffect } from 'react';
import AppShell from './AppShell';

export default function AppShellClient({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}