'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Zap, Cpu, Users, Megaphone, FileText, 
  Palette, Code, Activity, Briefcase, 
  CheckCircle, Clock, AlertCircle, MoreHorizontal 
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  profiles: string[];
}

const DEPARTMENTS: Department[] = [
  { id: 'command', name: 'Command Center', icon: <Zap className="w-5 h-5" />, color: 'spinach-500', profiles: [] },
  { id: 'ceo', name: 'CEO', icon: <Cpu className="w-5 h-5" />, color: 'purple-500', profiles: ['ceo'] },
  { id: 'cto', name: 'CTO', icon: <Activity className="w-5 h-5" />, color: 'blue-500', profiles: ['cto'] },
  { id: 'sales', name: 'Sales', icon: <Users className="w-5 h-5" />, color: 'orange-500', profiles: ['sales'] },
  { id: 'marketing', name: 'Marketing', icon: <Megaphone className="w-5 h-5" />, color: 'pink-500', profiles: ['marketing'] },
  { id: 'content', name: 'Content', icon: <FileText className="w-5 h-5" />, color: 'indigo-500', profiles: ['content'] },
  { id: 'design', name: 'Design', icon: <Palette className="w-5 h-5" />, color: 'cyan-500', profiles: ['design'] },
  { id: 'engineering', name: 'Engineering', icon: <Code className="w-5 h-5" />, color: 'emerald-500', profiles: ['engineering'] },
  { id: 'ops', name: 'Operations', icon: <Briefcase className="w-5 h-5" />, color: 'amber-500', profiles: ['ops'] },
  { id: 'clients', name: 'Clients', icon: <Users className="w-5 h-5" />, color: 'violet-500', profiles: [] },
  { id: 'tasks', name: 'Tasks', icon: <CheckCircle className="w-5 h-5" />, color: 'sky-500', profiles: [] },
];

const STATUS_ICONS = {
  idle: <Clock className="w-3 h-3 text-muted-foreground" />,
  thinking: <Activity className="w-3 h-3 text-amber-500 animate-pulse" />,
  working: <CheckCircle className="w-3 h-3 text-spinach-500 animate-pulse" />,
  speaking: <Activity className="w-3 h-3 text-violet-500 animate-pulse" />,
  blocked: <AlertCircle className="w-3 h-3 text-red-500" />,
};

interface DepartmentSidebarProps {
  agents: Array<{ agent: string; state: string; activity: string }>;
  workflows: any[];
  onFilterChange: (filter: string) => void;
}

export function DepartmentSidebar({ agents, workflows, onFilterChange }: DepartmentSidebarProps) {
  const [activeFilter, setActiveFilter] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<string[]>(['command']);

  const getAgentState = (profile: string) => {
    return agents.find(a => a.agent === profile)?.state || 'idle';
  };

  const getActiveCount = (profiles: string[]) => {
    return profiles.filter(p => getAgentState(p) === 'working').length;
  };

  const handleFilter = (id: string) => {
    setActiveFilter(activeFilter === id ? null : id);
    onFilterChange(activeFilter === id ? '' : id);
  };

  return (
    <aside className={cn(
      'border-r border-border bg-dark-300/50 backdrop-blur-sm transition-all duration-300',
      'flex flex-col overflow-y-auto'
    )}>
      {/* Department List */}
      <nav className="flex-1 p-3 space-y-1" role="navigation" aria-label="Departments">
        {DEPARTMENTS.map((dept) => {
          const isActive = activeFilter === dept.id;
          const activeAgents = getActiveCount(dept.profiles);
          const totalAgents = dept.profiles.length;
          
          return (
            <button
              key={dept.id}
              onClick={() => handleFilter(dept.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                'hover:bg-dark-200',
                isActive && 'bg-spinach-500/10 border border-spinach-500/30'
              )}
              aria-pressed={isActive}
            >
              <div className={cn(
                'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                `bg-${dept.color}/20 text-${dept.color}`
              )}>
                {dept.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('font-medium truncate', isActive ? 'text-spinach-400' : 'text-foreground')}>
                  {dept.name}
                </p>
                {totalAgents > 0 && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {STATUS_ICONS[getAgentState(dept.profiles[0]) as keyof typeof STATUS_ICONS] || null}
                    {activeAgents}/{totalAgents} active
                  </p>
                )}
              </div>
              {totalAgents > 0 && activeAgents > 0 && (
                <span className="w-5 h-5 rounded-full bg-spinach-500/20 text-spinach-400 text-xs flex items-center justify-center">
                  {activeAgents}
                </span>
              )}
            </button>
          );
        })}

        {/* Divider */}
        <div className="border-t border-border my-2" />

        {/* Quick Stats */}
        <div className="px-3 pb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Quick Stats
          </h3>
          <div className="space-y-2">
            <StatRow label="Active Agents" value={agents.filter(a => a.state === 'working').length} total={agents.length} color="spinach-500" />
            <StatRow label="Pending Approvals" value={0} color="amber-500" />
            <StatRow label="Active Workflows" value={workflows.filter(w => w.status === 'active').length} color="blue-500" />
          </div>
        </div>
      </nav>

      {/* Bottom Actions */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <button className="flex-1 px-3 py-2 bg-spinach-500/10 text-spinach-400 rounded-lg text-sm font-medium hover:bg-spinach-500/20 transition-colors">
            <MoreHorizontal className="w-4 h-4 mr-1" />
            More
          </button>
        </div>
      </div>
    </aside>
  );
}

function StatRow({ label, value, total, color }: { label: string; value: number; total?: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className={cn('font-mono font-semibold', `text-${color}`)}>{value}</span>
        {total !== undefined && (
          <span className="text-xs text-muted-foreground">/{total}</span>
        )}
      </div>
    </div>
  );
}