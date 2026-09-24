'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { 
  Zap, Cpu, Users, Megaphone, FileText, 
  Palette, Code, Activity, Briefcase,
  ArrowUpRight, MessageSquare, BarChart2
} from 'lucide-react';

interface FeedItem {
  id: string;
  timestamp: string;
  profile: string;
  action: string;
  details?: string;
}

const PROFILE_ICONS: Record<string, React.ReactNode> = {
  ceo: <Cpu className="w-4 h-4 text-purple-400" />,
  cto: <Activity className="w-4 h-4 text-blue-400" />,
  research: <MessageSquare className="w-4 h-4 text-indigo-400" />,
  social: <Megaphone className="w-4 h-4 text-pink-400" />,
  sales: <Users className="w-4 h-4 text-orange-400" />,
  content: <FileText className="w-4 h-4 text-indigo-400" />,
  design: <Palette className="w-4 h-4 text-cyan-400" />,
  engineering: <Code className="w-4 h-4 text-emerald-400" />,
  ops: <Briefcase className="w-4 h-4 text-amber-400" />,
  orchestrator: <Zap className="w-4 h-4 text-yellow-400" />,
};

interface ActivityFeedProps {
  feed: FeedItem[];
}

export function ActivityFeed({ feed }: ActivityFeedProps) {
  if (feed.length === 0) {
    return (
      <section className="animate-in">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-spinach-500" />
          Live Activity Feed
        </h2>
        <div className="bg-dark-300/50 rounded-2xl p-8 text-center">
          <Zap className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No activity yet. Send a command to start.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Zap className="w-5 h-5 text-spinach-500" />
          Live Activity Feed
        </h2>
        <span className="text-xs text-muted-foreground">{feed.length} events</span>
      </div>
      <div className="bg-dark-300/50 rounded-2xl border border-border/50 overflow-hidden">
        <div className="divide-y divide-border/50">
          {feed.slice(0, 20).map((item) => (
            <div 
              key={item.id} 
              className="px-4 py-3 hover:bg-dark-200/50 transition-colors flex items-start gap-3"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-spinach-500/10 flex items-center justify-center">
                {PROFILE_ICONS[item.profile] || <Activity className="w-5 h-5 text-spinach-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-foreground capitalize">{item.profile}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm text-foreground">{item.action}</span>
                </div>
                {item.details && (
                  <p className="text-sm text-muted-foreground truncate">{item.details}</p>
                )}
              </div>
              <time className="text-xs text-muted-foreground flex-shrink-0 mt-0.5">
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
              </time>
            </div>
          ))}
        </div>
        {feed.length > 20 && (
          <div className="p-4 text-center border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              Showing 20 of {feed.length} events
            </span>
          </div>
        )}
      </div>
    </section>
  );
}