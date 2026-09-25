'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { 
  FileText, MessageSquare, Megaphone, DollarSign, 
  Cpu, Palette, Code, Check, X, Clock, AlertCircle,
  Eye, Edit, Download, MoreHorizontal
} from 'lucide-react';

interface ApprovalItem {
  id: string;
  type: string;
  title: string;
  description?: string;
  platform?: string;
  status: string;
  client_id?: string;
  payload_json?: any;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  content: { icon: <FileText className="w-4 h-4" />, color: 'indigo-500', label: 'Content' },
  outreach: { icon: <MessageSquare className="w-4 h-4" />, color: 'blue-500', label: 'Outreach' },
  campaign: { icon: <Megaphone className="w-4 h-4" />, color: 'pink-500', label: 'Campaign' },
  spend: { icon: <DollarSign className="w-4 h-4" />, color: 'amber-500', label: 'Spend' },
  strategy: { icon: <Cpu className="w-4 h-4" />, color: 'purple-500', label: 'Strategy' },
  design: { icon: <Palette className="w-4 h-4" />, color: 'cyan-500', label: 'Design' },
  code: { icon: <Code className="w-4 h-4" />, color: 'emerald-500', label: 'Code' },
};

interface ApprovalQueueProps {
  approvals: ApprovalItem[];
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  actionPending?: string | null;
}

export function ApprovalQueue({ approvals, onApprove, onReject, actionPending }: ApprovalQueueProps) {
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  
  return (
    <section className="animate-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-amber-500" />
          Approval Queue
        </h2>
        {pendingApprovals.length > 0 && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
            {pendingApprovals.length} pending
          </span>
        )}
      </div>
      
      {approvals.length === 0 ? (
        <div className="bg-dark-300/50 rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No approvals needed</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => {
            const config = TYPE_CONFIG[approval.type] || { icon: <FileText className="w-4 h-4" />, color: 'gray-500', label: approval.type };
            const isPending = approval.status === 'pending';
            
            return (
              <article 
                key={approval.id} 
                className={cn(
                  'bg-dark-300/50 rounded-2xl border border-border/50 p-4',
                  'hover:border-spinach-500/30 transition-all duration-300',
                  isPending && 'border-amber-500/30 bg-amber-500/5'
                )}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                    `bg-${config.color}/20 text-${config.color}`
                  )}>
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground truncate">{approval.title}</h4>
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-xs font-medium',
                        isPending 
                          ? 'bg-amber-500/20 text-amber-400' 
                          : approval.status === 'approved' 
                            ? 'bg-spinach-500/20 text-spinach-400'
                            : 'bg-red-500/20 text-red-400'
                      )}>
                        {isPending ? 'Pending' : approval.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground capitalize">{config.label}</p>
                    {approval.platform && (
                      <p className="text-xs text-muted-foreground">Platform: {approval.platform}</p>
                    )}
                  </div>
                  {isPending && (
                    <Clock className="w-5 h-5 text-amber-400 mt-1 shrink-0" />
                  )}
                </div>
                
                {approval.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{approval.description}</p>
                )}
                
                {/* Preview payload */}
                {approval.payload_json && (
                  <details className="mb-3 group">
                    <summary className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                      <Eye className="w-3 h-3" />
                      Preview content
                    </summary>
                    <pre className="mt-2 p-3 bg-dark-200 rounded-lg text-xs text-muted-foreground overflow-auto max-h-32">
                      {JSON.stringify(approval.payload_json, null, 2)}
                    </pre>
                  </details>
                )}
                
                {/* Actions */}
                                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                  {isPending && (
                                    <>
                                      <button
                                        className="flex-1 px-3 py-2 min-h-[44px] bg-spinach-500 text-white rounded-lg text-sm font-medium hover:bg-spinach-400 transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onApprove?.(approval.id)}
                                        disabled={actionPending === approval.id}
                                      >
                                        <Check className="w-4 h-4" />
                                        {actionPending === approval.id ? 'Approving…' : 'Approve'}
                                      </button>
                                      <button
                                        className="flex-1 px-3 py-2 min-h-[44px] bg-red-500/20 text-red-400 rounded-lg text-sm font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onReject?.(approval.id)}
                                        disabled={actionPending === approval.id}
                                      >
                                        <X className="w-4 h-4" />
                                        {actionPending === approval.id ? 'Rejecting…' : 'Reject'}
                                      </button>
                                    </>
                                  )}
                  {!isPending && (
                    <div className="flex gap-2">
                      <button className="px-3 py-2 bg-dark-200 text-foreground rounded-lg text-sm hover:bg-dark-100 transition-colors flex items-center gap-1" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="px-3 py-2 bg-dark-200 text-foreground rounded-lg text-sm hover:bg-dark-100 transition-colors flex items-center gap-1" title="Edit">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}