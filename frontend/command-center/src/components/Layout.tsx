'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: (open: boolean) => void;
}

export function Layout({ children, sidebarOpen, onToggleSidebar }: LayoutProps) {
  return (
    <div className="h-screen bg-dark-200 flex flex-col">
      {/* Top Bar */}
      <header className="h-14 border-b border-border bg-dark-300/80 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <button
            onClick={() => onToggleSidebar(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-dark-100 transition-colors"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-spinach-500 to-spinach-700 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none"/>
              </svg>
            </div>
            <span className="font-semibold text-lg">Spinach OS</span>
            <span className="px-2 py-0.5 text-xs bg-spinach-500/20 text-spinach-400 rounded-full">v4</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground hidden sm:block">Director Mode</span>
          <div className="w-2 h-2 rounded-full bg-spinach-500 animate-pulse" title="System Active" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}