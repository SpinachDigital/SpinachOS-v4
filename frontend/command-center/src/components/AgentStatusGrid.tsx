'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  Cpu, Activity, Users, Megaphone, FileText, 
  Palette, Code, Briefcase, Zap,
  CheckCircle, Clock, AlertCircle, Loader2, MessageSquare
} from 'lucide-react';

interface AgentState {
  agent: string;
  state: 'idle' | 'thinking' | 'working' | 'speaking' | 'blocked';
  activity: string;
  current_task_id?: string;
}

const AGENT_CONFIG: Record<string, { name: string; icon: React.ReactNode; color: string; category: string }> = {
  ceo: { name: 'CEO', icon: <Cpu className="w-5 h-5" />, color: 'purple-500', category: 'Strategy' },
  cto: { name: 'CTO', icon: <Activity className="w-5 h-5" />, color: 'blue-500', category: 'Planning' },
  research: { name: 'Research', icon: <MessageSquare className="w-5 h-5" />, color: 'indigo-500', category: 'Intel' },
  social: { name: 'Social', icon: <Megaphone className="w-5 h-5" />, color: 'pink-500', category: 'Growth' },
  sales: { name: 'Sales', icon: <Users className="w-5 h-5" />, color: 'orange-500', category: 'Revenue' },
  content: { name: 'Content', icon: <FileText className="w-5 h-5" />, color: 'indigo-500', category: 'Creative' },
  design: { name: 'Design', icon: <Palette className="w-5 h-5" />, color: 'cyan-500', category: 'Creative' },
  engineering: { name: 'Engineering', icon: <Code className="w-5 h-5" />, color: 'emerald-500', category: 'Build' },
  ops: { name: 'Operations', icon: <Briefcase className="w-5 h-5" />, color: 'amber-500', category: 'Systems' },
  orchestrator: { name: 'Orchestrator', icon: <Zap className="w-5 h-5" />, color: 'yellow-500', category: 'Coordination' },
};

const STATE_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode; pulse: boolean }> = {
  idle: { color: 'gray-500', label: 'Idle', icon: <Clock className="w-3 h-3" />, pulse: false },
  thinking: { color: 'amber-500', label: 'Thinking', icon: <Activity className="w-3 h-3" />, pulse: true },
  working: { color: 'spinach-500', label: 'Working', icon: <CheckCircle className="w-3 h-3" />, pulse: true },
  speaking: { color: 'violet-500', label: 'Speaking', icon: <MessageSquare className="w-3 h-3" />, pulse: true },
  blocked: { color: 'red-500', label: 'Blocked', icon: <AlertCircle className="w-3 h-3" />, pulse: false },
};

interface AgentStatusGridProps {
  agents: AgentState[];
}

export function AgentStatusGrid({ agents }: AgentStatusGridProps) {
  return (
    <section className="animate-in">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-spinach-500" />
        Agent Status Grid
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {agents.map((agent) => {
          const config = AGENT_CONFIG[agent.agent] || { name: agent.agent, icon: <Activity className="w-5 h-5" />, color: 'gray-500', category: 'Agent' };
          const stateConfig = STATE_CONFIG[agent.state] || STATE_CONFIG.idle;
          
          return (
            <article 
              key={agent.agent} 
              className={cn(
                'bg-dark-300/50 rounded-2xl border border-border/50 p-4',
                'hover:border-spinach-500/30 transition-all duration-300',
                agent.state === 'working' && 'border-spinach-500/50 bg-spinach-500/5'
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                  `bg-${config.color}/10 text-${config.color}`
                )}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground truncate">{config.name}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      `bg-${stateConfig.color}/20 text-${stateConfig.color}`
                    )}>
                      {stateConfig.icon}
                      {stateConfig.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{config.category}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground w-20">Activity:</span>
                  <span className="text-foreground truncate flex-1">{agent.activity}</span>
                </div>
                {agent.current_task_id && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Task:</span>
                    <code className="bg-dark-200 px-1.5 py-0.5 rounded font-mono">
                      {agent.current_task_id.slice(0, 12)}...
                    </code>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}