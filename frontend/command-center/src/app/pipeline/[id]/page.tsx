'use client';
// Sprint 4: REAL pipeline detail page — PipelineHeader + PipelineSteps +
// StepDetail mounted (were unmounted since the Phase 3 rebuild), live from
// GET /api/v1/pipelines/:id (Sprint 4), advance via POST /api/v1/pipeline/advance.
// History updates live over WS + 10s poll while active.
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/auth';
import PipelineHeader from '@/components/pipeline/PipelineHeader';
import PipelineSteps from '@/components/pipeline/PipelineSteps';
import StepDetail from '@/components/pipeline/StepDetail';

interface Stage {
  index: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  agent: string;
  description?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

interface PipelinePayload {
  pipeline: {
    id: string;
    name: string;
    client_id: string | null;
    client_name: string | null;
    status: string;
    progress: number;
    current_step: string | null;
    total_steps: number;
    completed_steps: number;
    current_step_index: number;
    created_at: string;
  };
  stages: Stage[];
  history: { at: string; event: string; detail: string }[];
}

const STEPS_ADAPTER = (p: PipelinePayload) => ({
  pipelineId: p.pipeline.id,
  steps: p.stages.map(s => ({
    name: s.name,
    status: s.status,
    agent: s.agent,
    description: s.description,
  })),
  currentStep: p.pipeline.current_step_index < 0 ? 0 : p.pipeline.current_step_index,
  clientName: p.pipeline.client_name,
  subtitle: p.pipeline.name,
});

export default function PipelineDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [data, setData] = useState<PipelinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState<string | null>(null);
  const [advanceMsg, setAdvanceMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchPipeline = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/pipelines/${id}`);
      if (res.ok) {
        setData(await res.json());
        setError(null);
      } else if (res.status === 404) {
        setError('Pipeline not found — ye workflow delete ho chuka ya exist nahi karta.');
      } else {
        setError(`API ${res.status} unreachable — pipeline load failed.`);
      }
    } catch {
      setError('API unreachable — pipeline load failed.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);

  // live: 10s poll while the pipeline is active
  useEffect(() => {
    if (!data || data.pipeline.status !== 'active') return;
    const t = setInterval(fetchPipeline, 10000);
    return () => clearInterval(t);
  }, [data?.pipeline.status, fetchPipeline]);

  const advance = async (stepName: string) => {
    setAdvancing(stepName);
    setAdvanceMsg(null);
    try {
      const res = await apiFetch('/api/v1/pipeline/advance', {
        method: 'POST',
        body: JSON.stringify({ workflow_id: id, step_name: stepName }),
      });
      const j = await res.json();
      if (res.ok && j.success) {
        setAdvanceMsg({ ok: true, text: j.completed ? 'Pipeline completed' : `Advanced — next: ${j.next_step} (${j.agent}, ${j.progress}%)` });
        await fetchPipeline();
      } else {
        setAdvanceMsg({ ok: false, text: j.detail || j.error || `advance failed (${res.status})` });
      }
    } catch {
      setAdvanceMsg({ ok: false, text: 'API unreachable — advance failed.' });
    } finally {
      setAdvancing(null);
    }
  };

  if (loading) {
    return <div className="p-6" style={{ color: 'var(--text-faint)' }}>Loading pipeline...</div>;
  }
  if (error || !data) {
    return (
      <div className="p-6">
        <div className="page-head"><h1 className="t-title" style={{ color: 'var(--text)' }}>Pipeline</h1></div>
        <div style={{ padding: 18, borderRadius: 12, border: '1px solid #ef4444', background: 'rgba(239, 68, 68, 0.06)', color: '#ef4444', fontSize: 13, maxWidth: 520 }}>
          {error || 'Pipeline not found.'}
        </div>
      </div>
    );
  }

  const wf = STEPS_ADAPTER(data);
  const current = data.pipeline.current_step;
  const currentStage = data.stages.find(s => s.name === current);

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="page-head" style={{ padding: '18px 24px 0' }}>
        <div className="head-text">
          <h1 className="t-title" style={{ color: 'var(--text)' }}>
            {data.pipeline.client_name || data.pipeline.name}
          </h1>
          <p className="t-meta mt-0.5" style={{ color: 'var(--text-faint)' }}>
            {data.pipeline.name} · {data.pipeline.status} · {data.pipeline.progress}% · step {data.pipeline.completed_steps}/{data.pipeline.total_steps}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button onClick={fetchPipeline} className="btn btn-secondary btn-sm">Refresh</button>
        </div>
      </div>

      <div style={{ padding: '14px 24px 24px', display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 860 }}>
        {advanceMsg && (
          <div style={{
            padding: '10px 14px', borderRadius: 10, fontSize: 13,
            border: `1px solid ${advanceMsg.ok ? 'var(--green)' : '#ef4444'}`,
            background: advanceMsg.ok ? 'rgba(22, 163, 74, 0.08)' : 'rgba(239, 68, 68, 0.06)',
            color: advanceMsg.ok ? 'var(--green)' : '#ef4444',
          }}>{advanceMsg.text}</div>
        )}

        <PipelineHeader workflow={wf} />

        {data.pipeline.status === 'active' && currentStage && (
          <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--panel)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current stage</div>
                <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 600 }}>{currentStage.name.replace(/_/g, ' ')} <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-faint)' }}>· {currentStage.agent}</span></div>
              </div>
              <button
                onClick={() => advance(currentStage.name)}
                disabled={advancing !== null}
                className="btn btn-primary btn-sm"
                style={{ flexShrink: 0 }}
              >
                {advancing === currentStage.name ? 'Advancing...' : `Advance ${currentStage.name.replace(/_/g, ' ')}`}
              </button>
            </div>
          </div>
        )}

        <StepDetail workflow={wf} />
        <PipelineSteps workflow={wf} />

        {/* History — paginated per the scale rules (API returns bounded history; 20 default) */}
        <div style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border-soft)', background: 'var(--panel)' }}>
          <div style={{ fontSize: 11, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>History</div>
          {data.history.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>No stage events yet — advance a stage to start the trail.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {data.history.map((h, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'baseline' }}>
                  <span className="t-mono" style={{ color: 'var(--text-faint)', fontSize: 10, flexShrink: 0 }}>{new Date(h.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="t-mono" style={{ color: h.event === 'completed' ? 'var(--green)' : '#22d3ee', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{h.event.toUpperCase()}</span>
                  <span style={{ color: 'var(--text-dim)', minWidth: 0 }}>{h.detail}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
