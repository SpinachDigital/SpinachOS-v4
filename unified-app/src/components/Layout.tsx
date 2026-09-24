'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import CommandCenter from '@/pages/command-center/page';
import Office3D from '@/pages/office-3d/page';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { CommandBar } from '@/components/CommandBar';
import { ControlPanel } from '@/components/ControlPanel';

interface LayoutProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  onToggleSidebar: (open: boolean) => void;
  activeView: 'command' | 'office';
  onSetActiveView: (view: 'command' | 'office') => void;
}

export function Layout({ children, sidebarOpen, onToggleSidebar, activeView, onSetActiveView }: LayoutProps) {
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
          <button
            onClick={() => onSetActiveView(activeView === 'command' ? 'office' : 'command')}
            className="p-2 rounded-lg hover:bg-dark-100 transition-colors"
            aria-label={`Switch to ${activeView === 'command' ? '3D Office' : 'Command Center'} View`}
          >
            <svg className="w-5 h-5 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {activeView === 'command' ? (
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <div className="grid grid-cols-[280px_1fr_320px] h-[calc(100vh-60px)] overflow-hidden">
          {/* LEFT: Department Sidebar */}
          <aside className="border-r border-border bg-dark-300/50 backdrop-blur-sm transition-all duration-300 flex flex-col overflow-y-auto">
            <nav className="flex-1 p-3 space-y-1" role="navigation" aria-label="Departments">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-spinach-500/20 text-spinach-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-zap w-5 h-5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">Command Center</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-purple-500/20 text-purple-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-cpu w-5 h-5">
                    <rect x="4" y="4" width="16" height="16" rx="2"></rect>
                    <rect x="9" y="9" width="6" height="6"></rect>
                    <path d="M15 2v2"></path>
                    <path d="M15 20v2"></path>
                    <path d="M2 15h2"></path>
                    <path d="M2 9h2"></path>
                    <path d="M20 15h2"></path>
                    <path d="M20 9h2"></path>
                    <path d="M9 2v2"></path>
                    <path d="M9 20v2"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">CEO</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Strategy</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/20 text-blue-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-activity w-5 h-5">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">CTO</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Planning</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-orange-500/20 text-orange-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-users w-5 h-5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4-4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Sales</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Revenue</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-pink-500/20 text-pink-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-megaphone w-5 h-5">
                    <path d="m3 11 18-5v12L3 14v-3z"></path>
                    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Marketing</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Growth</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-indigo-500/20 text-indigo-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-file-text w-5 h-5">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" x2="8" y1="13" y2="13"></line>
                    <line x1="16" x2="8" y1="17" y2="17"></line>
                    <line x1="10" x2="8" y1="9" y2="9"></line>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Content</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Creative</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-cyan-500/20 text-cyan-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-palette w-5 h-5">
                    <circle cx="13.5" cy="6.5" r=".5"></circle>
                    <circle cx="17.5" cy="10.5" r=".5"></circle>
                    <circle cx="8.5" cy="7.5" r=".5"></circle>
                    <circle cx="6.5" cy="12.5" r=".5"></circle>
                    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Design</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Creative</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-code w-5 h-5">
                    <polyline points="16 18 22 12 16 6"></polyline>
                    <polyline points="8 6 2 12 8 18"></polyline>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Engineering</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Build</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-500/20 text-amber-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-briefcase w-5 h-5">
                    <rect width="20" height="14" x="2" y="7" rx="2" ry="2"></rect>
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2-2v16"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Operations</h3>
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
                      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-clock w-3 h-3">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      0/1 active
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Systems</p>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-violet-500/20 text-violet-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-users w-5 h-5">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4-4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Clients</h3>
                  </div>
                </div>
              </button>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
                aria-pressed={false}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-sky-500/20 text-sky-500">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-check-circle w-5 h-5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <path d="m9 11 3 3L22 4"></path>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">Tasks</h3>
                  </div>
                </div>
              </button>
              <div className="border-t border-border my-2"></div>
              <div className="px-3 pb-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Stats</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Active Agents</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-spinach-500">0</span>
                      <span className="text-xs text-muted-foreground">/9</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Pending Approvals</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-amber-500">0</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Active Workflows</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-blue-500">0</span>
                    </div>
                  </div>
                </div>
              </div>
            </nav>
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <button className="flex-1 px-3 py-2 bg-spinach-500/10 text-spinach-400 rounded-lg text-sm font-medium hover:bg-spinach-500/20 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-more-horizontal w-4 h-4 mr-1">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="19" cy="12" r="1"></circle>
                    <circle cx="5" cy="12" r="1"></circle>
                  </svg>
                  More
                </button>
              </div>
            </div>
          </aside>

          {/* MAIN: Command Center or 3D Office */}
          <main className="overflow-y-auto p-6 bg-dark-100">
            {activeView === 'command' ? (
              <CommandCenter />
            ) : (
              <Office3D />
            )}
          </main>

          {/* RIGHT: Approvals + Controls */}
          <aside className="border-l border-border bg-dark-50 overflow-y-auto p-4">
            <div className="space-y-6">
              <ApprovalQueue approvals={[]} />
              <ControlPanel />
            </div>
          </aside>
        </div>
      </main>

      {/* BOTTOM: Command Bar */}
      <CommandBar />
    </div>
  );
}