'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Zap, FileText, Users, Palette,
  CheckCircle, Clock, AlertCircle,
  TrendingUp, ExternalLink
} from 'lucide-react';

interface WorkflowItem {
  id: string;
  name: string;
  progress: number;
  current_step: string;
  status: string;
  client_id?: string;
}

const WORKFLOW_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  client_pipeline: Zap,
  content_campaign: FileText,
  lead_generation: Users,
  brand_creation: Palette,
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ComponentType<{ className?: string }>; label: string }> = {
  active: { color: 'spinach-500', icon: CheckCircle, label: 'Active' },
  paused: { color: 'amber-500', icon: Clock, label: 'Paused' },
  completed: { color: 'blue-500', icon: CheckCircle, label: 'Completed' },
  failed: { color: 'red-500', icon: AlertCircle, label: 'Failed' },
  cancelled: { color: 'gray-500', icon: AlertCircle, label: 'Cancelled' },
};

interface WorkflowCardsProps {
  workflows: WorkflowItem[];
}

export function WorkflowCards({ workflows }: WorkflowCardsProps) {
  if (workflows.length === 0) {
    return (
      <section className="animate-in">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-spinach-500" />
          Active Workflows
        </h2>
        <div className="bg-warm-100 rounded-2xl p-8 text-center border border-warm-200">
          <TrendingUp className="w-12 h-12 text-warm-500/30 mx-auto mb-4" />
          <p className="text-warm-600">No active workflows. Start a client pipeline.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-in">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-spinach-500" />
        Active Workflows
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {workflows.map((workflow) => {
          const statusConfig = STATUS_CONFIG[workflow.status] || STATUS_CONFIG.active;
          const Icon = WORKFLOW_ICONS[workflow.name] || Zap;
          const StatusIcon = statusConfig.icon;

          return (
            <article
              key={workflow.id}
              className="bg-white rounded-2xl border border-warm-200 shadow-card p-5 hover:border-spinach-500/30 transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-spinach-500/10 flex items-center justify-center">
                    <Icon className="text-spinach-500 w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-warm-900">{workflow.name.replace('_', ' ')}</h3>
                    <p className="text-xs text-warm-600 capitalize">{workflow.current_step || 'Initializing'}</p>
                  </div>
                </div>
                <span className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-warm-100 text-warm-700">
                  <StatusIcon className="w-4 h-4" />
                  {statusConfig.label}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-warm-600">Progress</span>
                  <span className="font-mono font-semibold text-spinach-400">{workflow.progress}%</span>
                </div>
                <div className="h-2 bg-warm-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-spinach-500 to-spinach-400 rounded-full transition-all duration-500"
                    style={{ width: `${workflow.progress}%` }}
                  />
                </div>
              </div>

              {/* Steps Preview */}
              <div className="pt-3 border-t border-warm-200">
                <p className="text-xs text-warm-600 mb-2">Current: {workflow.current_step || 'Waiting...'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-warm-600">Client: {workflow.client_id?.slice(0, 8) || '—'}</span>
                  <button className="text-xs text-spinach-600 hover:text-spinach-500 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Details
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}