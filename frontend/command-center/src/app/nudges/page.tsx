'use client';

// /nudges — N3.22 "Next up": proactive nudges as a first-class surface.
// One suggestion + one-click action per nudge. Never auto-acts.

import NudgeList from '@/components/nudges/NudgeList';

export default function NudgesPage() {
  return (
    <main style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
      <h1 className="t-title" style={{ color: 'var(--text)', margin: '0 0 4px' }}>Next up</h1>
      <p className="t-meta" style={{ color: 'var(--text-faint)', margin: '0 0 20px' }}>
        Stale approvals, silent leads, stuck pipelines — the system proposes, you decide.
      </p>
      <NudgeList />
    </main>
  );
}
