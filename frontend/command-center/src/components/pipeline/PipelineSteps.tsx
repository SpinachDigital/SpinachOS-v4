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

export default function PipelineSteps({ workflow }: { workflow: WorkflowData }) {
  return (
    <div className="bg-warm-50 rounded-lg p-4 border border-warm-200">
      <h3 className="text-lg font-medium text-warm-900 mb-4">Workflow Steps</h3>
      <div className="space-y-2">
        {workflow.steps.map((step, index) => (
          <div key={step.name} className="flex items-center gap-3 p-3 rounded bg-warm-100 hover:bg-warm-200 transition-colors cursor-pointer">
            {/* Step number */}
            <div className="flex-shrink-0">
              <div className="h-8 w-8 flex items-center justify-center rounded-lg 
                 ${step.status === 'completed' ? 'bg-teal-500' : step.status === 'in_progress' ? 'bg-teal-400' : 'bg-warm-200'} 
                 text-white">
                {index + 1}
              </div>
            </div>
            {/* Step details */}
            <div className="flex-1">
              <p className="text-sm font-medium text-warm-900">{step.name.replace('_', ' ')}</p>
              <p className="text-xs text-warm-500">Agent: {step.agent.toUpperCase()}</p>
              {step.description && (
                <p className="text-xs text-warm-400 mt-1">{step.description}</p>
              )}
            </div>
            {/* Status indicator */}
            <div className="flex-shrink-0">
              {step.status === 'completed' && (
                <svg className="h-4 w-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {step.status === 'in_progress' && (
                <svg className="h-4 w-4 text-teal-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.001 8.001 0 01-15.356-2m0 0A8.001 8.001 0 0119.418 15H15"></path>
                </svg>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}