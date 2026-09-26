-- Sprint 1: task_outputs — where agent deliverables land on task completion.
-- Re-runnable: IF NOT EXISTS everywhere; index created separately.
CREATE TABLE IF NOT EXISTS public.task_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','file','link')),
  title TEXT,
  body TEXT,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scale rule §4.2: index every FK + ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_task_outputs_task_created
  ON public.task_outputs (task_id, created_at DESC);

ALTER TABLE public.task_outputs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "task_outputs_service_full" ON public.task_outputs;
CREATE POLICY "task_outputs_service_full" ON public.task_outputs
  FOR ALL TO service_role USING (true) WITH CHECK (true);
