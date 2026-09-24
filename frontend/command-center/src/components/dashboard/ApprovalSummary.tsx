import { useParams } from 'next/navigation';

interface Approval {
  id: string;
  pipelineId: string;
  title: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export default function ApprovalSummary({ approvals }: { approvals: Approval[] }) {
  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  if (approvals.length === 0) {
    return (
      <div className="bg-warm-50 rounded-lg p-4 border border-warm-200">
        <h3 className="text-lg font-medium text-warm-900 mb-2">Approval Queue</h3>
        <p className="text-warm-500">No pending approvals</p>
      </div>
    );
  }

  return (
    <div className="bg-warm-50 rounded-lg p-4 border border-warm-200">
      <h3 className="text-lg font-medium text-warm-900 mb-2 flex justify-between items-center">
        <span>Approval Queue</span>
        {pendingCount > 0 && (
          <span className="bg-amber-500/20 px-2 py-0.5 rounded text-amber-500 text-[0.75rem]">
            {pendingCount} pending
          </span>
        )}
      </h3>
      <div className="space-y-2">
        {approvals
          .filter(a => a.status === 'pending')
          .slice(0, 3)
          .map((approval) => (
            <div key={approval.id} className="flex items-start gap-3 p-3 bg-warm-100 rounded hover:bg-warm-200 transition-colors">
              {/* Approval type icon */}
              <div className="flex-shrink-0">
                <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-amber-500 text-white">
                  <span className="text-xs font-medium">A</span>
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-warm-900">{approval.title}</h4>
                <p className="text-xs text-warm-500">Requested by: {approval.requestedBy}</p>
                <p className="text-xs text-warm-500">Pipeline: {approval.pipelineId}</p>
              </div>
              {/* Actions */}
              <div className="flex-shrink-0 space-x-2">
                <button
                  className="p-1 rounded hover:bg-teal-500/20"
                  title="Approve"
                >
                  <svg className="h-4 w-4 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  className="p-1 rounded hover:bg-red-500/20"
                  title="Reject"
                >
                  <svg className="h-4 w-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        {approvals.length > 3 && (
          <div className="text-center text-warm-500 text-[0.75rem] py-2">
            and {approvals.length - 3} more...
          </div>
        )}
      </div>
    </div>
  );
}