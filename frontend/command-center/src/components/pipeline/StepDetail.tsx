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

export default function StepDetail({ workflow }: { workflow: WorkflowData }) {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const currentStep = workflow.steps[workflow.currentStep];

  if (!currentStep) {
    return null;
  }

  return (
    <div className="bg-[var(--panel)] rounded-lg p-4 border border-[var(--panel-2)]">
      <h3 className="text-lg font-medium text-[var(--text)] mb-4">Current Step</h3>
      <div className="space-y-4">
        <div className="flex items-start gap-4">
          {/* Step status indicator */}
          <div className="flex-shrink-0 mt-2">
            <div className={`h-8 w-8 rounded-full 
               ${currentStep.status === 'completed' ? 'bg-[var(--green)]' : currentStep.status === 'in_progress' ? 'bg-[var(--green)]' : 'bg-[var(--card-hover)]'} 
               flex items-center justify-center text-white text-sm font-medium`}>
              {currentStep.status === 'completed' ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                </svg>
              ) : currentStep.status === 'in_progress' ? (
                <svg className="h-4 w-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.001 8.001 0 01-15.356-2m0 0A8.001 8.001 0 0119.418 15H15"></path>
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3" />
                </svg>
              )}
            </div>
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-[var(--text)]">{currentStep.name.replace('_', ' ')}</h4>
            <p className="text-[var(--text-dim)]">{currentStep.description || `Step handled by ${currentStep.agent.toUpperCase()} team`}</p>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="font-medium">Agent:</span>
              <span className="bg-[var(--green)]/20 px-2 py-0.5 rounded text-[var(--green)] text-[0.75rem]">{currentStep.agent.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex justify-end space-x-3">
          {currentStep.status === 'pending' && (
            <button
              className="px-4 py-2 bg-[var(--green)] text-[var(--panel)] rounded hover:bg-[var(--green)] transition-colors"
              onClick={() => {
                // TODO: Implement step start via WebSocket or API
                console.log(`Starting step: ${currentStep.name}`);
              }}
            >
              Start Step
            </button>
          )}
          {currentStep.status === 'in_progress' && (
            <>
              <button
                className="px-4 py-2 bg-[var(--card-hover)] text-[var(--text)] rounded hover:bg-[var(--card-hover)] transition-colors"
                onClick={() => {
                  // TODO: Implement step completion
                  console.log(`Completing step: ${currentStep.name}`);
                }}
              >
                Complete Step
              </button>
              <button
                className="px-4 py-2 bg-[var(--card-hover)] text-[var(--text)] rounded hover:bg-[var(--card-hover)] transition-colors"
                onClick={() => {
                  // TODO: Implement step block
                  console.log(`Blocking step: ${currentStep.name}`);
                }}
              >
                Block
              </button>
            </>
          )}
          {currentStep.status === 'completed' && (
            <button
              className="px-4 py-2 bg-[var(--card-hover)] text-[var(--text)] rounded hover:bg-[var(--card-hover)] transition-colors"
              onClick={() => {
                // TODO: Implement step reopen
                console.log(`Reopening step: ${currentStep.name}`);
              }}
            >
              Reopen Step
            </button>
          )}
        </div>
      </div>
    </div>
  );
}