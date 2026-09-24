"use client";

export default function KanbanPage() {
  return (
    <div className="w-full h-full p-6 bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-600/20 flex items-center justify-center border border-green-500/30">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2M15 7v10a2 2 0 01-2 2h-2m0-10a2 2 0 002 2h2a2 2 0 002-2M9 7v10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 002-2M9 7h2a2 2 0 012 2m0 10V7" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">Kanban</h2>
          <p className="text-gray-400">Task boards coming soon...</p>
        </div>
      </div>
    </div>
  );
}