'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Zap, Cpu, Activity, Users, Megaphone, 
  FileText, Palette, Code, Briefcase, 
  AlertCircle, TrendingUp, Users as UsersIcon
} from 'lucide-react';

interface AgentItem {
  agent: string;
  state: 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';
  activity: string;
}

interface DepartmentSidebarProps {
  agents: AgentItem[];
  workflows: any[];
  onFilterChange: (filter: string) => void;
}

export function DepartmentSidebar({ agents, workflows, onFilterChange }: DepartmentSidebarProps) {
  const stateColors: Record<string, string> = {
    idle: 'text-spinach-400',
    thinking: 'text-amber-400',
    working: 'text-blue-400',
    speaking: 'text-purple-400',
    blocked: 'text-red-400',
  };

  const stateLabels: Record<string, string> = {
    idle: 'Idle',
    thinking: 'Thinking',
    working: 'Working',
    speaking: 'Speaking',
    blocked: 'Blocked',
  };

  const agentIcons: Record<string, React.ReactNode> = {
    ceo: <Cpu className="w-4 h-4" />,
    cto: <Activity className="w-4 h-4" />,
    research: <UsersIcon className="w-4 h-4" />,
    social: <Megaphone className="w-4 h-4" />,
    sales: <Users className="w-4 h-4" />,
    content: <FileText className="w-4 h-4" />,
    design: <Palette className="w-4 h-4" />,
    engineering: <Code className="w-4 h-4" />,
    ops: <Briefcase className="w-4 h-4" />,
  };

  return (
    <nav className="flex-1 p-3 space-y-1" role="navigation" aria-label="Departments">
      <button
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 hover:bg-dark-200"
        aria-pressed={false}
      >
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-spinach-500/20 text-spinach-500">
          <Zap className="w-5 h-5" />
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
          <Cpu className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">CEO</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <Activity className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">CTO</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <Users className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">Sales</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <Megaphone className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">Marketing</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <FileText className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">Content</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <Palette className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">Design</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <Code className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">Engineering</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <Briefcase className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">Operations</h3>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-500/20 text-gray-500">
              <span className={stateColors['idle']}>{stateLabels['idle']}</span>
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
          <Users className="w-5 h-5" />
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
          <TrendingUp className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground truncate">Tasks</h3>
          </div>
        </div>
      </button>
      <div className="border-t border-border my-2"></div>
      <div className="px-3 pb-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Filters</h3>
        <div className="space-y-2">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 bg-dark-200/50 border border-border/30 text-foreground hover:bg-dark-100"
            onClick={() => onFilterChange('all')}
          >
            All Departments
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 bg-dark-200/50 border border-border/30 text-foreground hover:bg-dark-100"
            onClick={() => onFilterChange('active')}
          >
            Active Only
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-200 bg-dark-200/50 border border-border/30 text-foreground hover:bg-dark-100"
            onClick={() => onFilterChange('workflows')}
          >
            Workflows
          </button>
        </div>
      </div>
    </nav>
  );
}