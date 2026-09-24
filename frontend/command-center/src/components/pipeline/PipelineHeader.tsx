import { useParams } from 'next/navigation';

interface WorkflowStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  agent: string;
  description?: string;
}

interface WorkflowData {
  pipelineId: string;
  steps: WorkflowStep[];
  currentStep: number;
}

export default function PipelineHeader({ workflow }: { workflow: WorkflowData }) {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  // In a real app, we would fetch client details from the workflow or a separate API
  const clientName = 'Mira Road Gym'; // Placeholder

  return (
    <div className="bg-warm-50 rounded-lg p-4 border border-warm-200 mb-4">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-xl font-bold text-warm-900">{clientName}</h2>
          <p className="text-warm-600">Growth Strategy & Launch</p>
        </div>
        <div className="text-right">
          <div className="flex items-baseline gap-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" />
              </svg>
              <p className="text-sm font-medium text-warm-900">{workflow.currentStep + 1}/8</p>
            </div>
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H3m8 4H3m-4 8h10a2 2 0 002-2V9a2 2 0 00-2-2h-2" />
              </svg>
              <p className="text-sm font-medium text-warm-900">{workflow.steps.filter(s => s.status === 'completed').length} Done</p>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-warm-200 rounded-full h-2.5 mb-4">
        <div
          className="bg-teal-500 h-2.5 rounded-full"
          style={{ width: `${(workflow.currentStep / workflow.steps.length) * 100}%` }}
        ></div>
      </div>

      {/* Step timeline */}
      <div className="space-y-3">
        {workflow.steps.map((step, index) => (
          <div key={step.name} className="flex items-center gap-3">
            {/* Step marker */}
            <div className="flex-shrink-0">
              <div className={`h-3 w-3 rounded-full 
                 ${step.status === 'completed' ? 'bg-teal-500' : step.status === 'in_progress' ? 'bg-teal-400' : 'bg-warm-200'}`}
              />
            </div>
            {/* Step content */}
            <div className="flex-1">
              <p className="text-sm font-medium text-warm-900">{step.name.replace('_', ' ')}</p>
              <p className="text-xs text-warm-500">{step.agent.toUpperCase()}</p>
            </div>
            {/* Status indicator for completed steps */}
            {step.status === 'completed' && (
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}