import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Workflow {
  id: string;
  name: string;
  progress: number; // 0-100
  current_step: string;
  status: string;
  client_id?: string;
}

export default function WorkflowCards({ workflows }: { workflows: Workflow[] }) {
  // If no workflows, show a placeholder
  if (!workflows || workflows.length === 0) {
    return (
      <div className="bg-[var(--panel)] rounded-lg p-4 border border-[var(--panel-2)]">
        <h3 className="text-lg font-medium text-[var(--text)] mb-2">Active Workflows</h3>
        <p className="text-[var(--text-dim)]">No active workflows</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--panel)] rounded-lg p-4 border border-[var(--panel-2)]">
      <h3 className="text-lg font-medium text-[var(--text)] mb-4">Active Workflows</h3>
      <div className="space-y-3">
        {workflows.map((workflow) => (
          <Link
            key={workflow.id}
            href={`/pipeline/${workflow.id}`}
            className="block"
          >
            <div className="flex items-start gap-4 p-3 bg-[var(--card)] rounded hover:bg-[var(--card-hover)] transition-colors cursor-pointer">
              {/* Status indicator */}
              <div className="flex-shrink-0 mt-1">
                <div className={`h-3 w-3 rounded-full
                   ${workflow.status === 'completed' ? 'bg-[var(--green)]' : workflow.status === 'active' ? 'bg-[var(--green)]' : workflow.status === 'pending' ? 'bg-amber-400' : 'bg-red-500'}`}
                />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-[var(--text)]">{workflow.name.replace('_', ' ')}</h4>
                <p className="text-xs text-[var(--text-dim)] mb-1">{workflow.current_step}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">Progress:</span>
                  <div className="w-24 bg-[var(--card-hover)] rounded-full h-2">
                    <div
                      className="bg-[var(--green)] h-2 rounded-full"
                      style={{ width: `${workflow.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-[var(--text-dim)]">{workflow.progress}%</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}