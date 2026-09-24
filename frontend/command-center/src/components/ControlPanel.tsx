'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  PauseCircle, PlayCircle, RotateCcw, 
  Zap, AlertTriangle, Settings,
  Power, Shield, Database
} from 'lucide-react';

interface ControlPanelProps {
  onPause?: () => void;
  onResume?: () => void;
  onRestart?: () => void;
  onOverride?: () => void;
}

export function ControlPanel({ onPause, onResume, onRestart, onOverride }: ControlPanelProps) {
  const [systemPaused, setSystemPaused] = React.useState(false);

  const controls = [
    {
      id: 'pause',
      label: systemPaused ? 'Resume System' : 'Pause System',
      icon: systemPaused ? <PlayCircle className="w-5 h-5" /> : <PauseCircle className="w-5 h-5" />,
      color: systemPaused ? 'spinach-500' : 'amber-500',
      onClick: () => {
        setSystemPaused(!systemPaused);
        if (systemPaused) onResume?.(); else onPause?.();
      },
      variant: 'primary' as const,
    },
    {
      id: 'restart',
      label: 'Restart Workflow',
      icon: <RotateCcw className="w-5 h-5" />,
      color: 'blue-500',
      onClick: onRestart,
      variant: 'secondary' as const,
    },
    {
      id: 'override',
      label: 'Emergency Override',
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'red-500',
      onClick: onOverride,
      variant: 'danger' as const,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      color: 'gray-500',
      onClick: () => console.log('Open settings'),
      variant: 'ghost' as const,
    },
  ];

  return (
    <section className="animate-in">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        System Controls
      </h3>
      <div className="space-y-2">
        {controls.map((control) => (
          <button
            key={control.id}
            onClick={control.onClick}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-xl',
              'transition-all duration-200',
              control.variant === 'primary' && (
                `bg-${control.color}/10 border border-${control.color}/30 text-${control.color} hover:bg-${control.color}/20`
              ),
              control.variant === 'secondary' && (
                `bg-${control.color}/10 border border-${control.color}/30 text-${control.color} hover:bg-${control.color}/20`
              ),
              control.variant === 'danger' && (
                `bg-${control.color}/10 border border-${control.color}/30 text-${control.color} hover:bg-${control.color}/20`
              ),
              control.variant === 'ghost' && (
                'bg-dark-200 border border-border/50 text-foreground hover:bg-dark-100'
              )
            )}
          >
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', `bg-${control.color}/20 text-${control.color}`)}>
              {control.icon}
            </div>
            <span className="font-medium">{control.label}</span>
          </button>
        ))}
      </div>

      {/* System Status Indicators */}
      <div className="mt-4 pt-4 border-t border-border/50">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          System Status
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatusIndicator label="Gateway" status="online" icon={<Zap className="w-4 h-4" />} />
          <StatusIndicator label="Database" status="online" icon={<Database className="w-4 h-4" />} />
          <StatusIndicator label="Auth" status="online" icon={<Shield className="w-4 h-4" />} />
        </div>
      </div>
    </section>
  );
}

interface StatusIndicatorProps {
  label: string;
  status: 'online' | 'offline' | 'degraded';
  icon: React.ReactNode;
}

function StatusIndicator({ label, status, icon }: StatusIndicatorProps) {
  const colors = {
    online: 'spinach-500',
    offline: 'red-500',
    degraded: 'amber-500',
  };

  return (
    <div className="flex flex-col items-center gap-2 p-3 bg-dark-200/50 rounded-xl">
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center',
        `bg-${colors[status]}/20 text-${colors[status]}`
      )}>
        {icon}
      </div>
      <span className="text-xs font-medium text-foreground">{label}</span>
      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-mono', `bg-${colors[status]}/20 text-${colors[status]}`)}>
        {status}
      </span>
    </div>
  );
}