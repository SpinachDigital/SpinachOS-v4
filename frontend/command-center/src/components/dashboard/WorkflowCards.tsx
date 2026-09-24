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
      <div className="bg-warm-50 rounded-lg p-4 border border-warm-200">
        <h3 className="text-lg font-medium text-warm-900 mb-2">Active Workflows</h3>
        <p className="text-warm-500">No active workflows</p>
      </div>
    );
  }

  return (
    <div className="bg-warm-50 rounded-lg p-4 border border-warm-200">
      <h3 className="text-lg font-medium text-warm-900 mb-4">Active Workflows</h3>
      <div className="space-y-3">
        {workflows.map((workflow) => (
          <Link
            key={workflow.id}
            href={`/pipeline/${workflow.id}`}
            className="block"
          >
            <div className="flex items-start gap-4 p-3 bg-warm-100 rounded hover:bg-warm-200 transition-colors cursor-pointer">
              {/* Status indicator */}
              <div className="flex-shrink-0 mt-1">
                <div className={`h-3 w-3 rounded-full
                   ${workflow.status === 'completed' ? 'bg-teal-500' : workflow.status === 'active' ? 'bg-teal-400' : workflow.status === 'pending' ? 'bg-amber-400' : 'bg-red-500'}`}
                />
              </div>
              <div className="flex-1">
                <h4 className="text-base font-semibold text-warm-900">{workflow.name.replace('_', ' ')}</h4>
                <p className="text-xs text-warm-500 mb-1">{workflow.current_step}</p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">Progress:</span>
                  <div className="w-24 bg-warm-200 rounded-full h-2">
                    <div
                      className="bg-teal-500 h-2 rounded-full"
                      style={{ width: `${workflow.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-warm-500">{workflow.progress}%</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}