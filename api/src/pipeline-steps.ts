/*
 * pipeline-steps.ts — DEFAULT_PIPELINE_STEPS (Phase 3 split, monolith L1347–1356).
 */
export const DEFAULT_PIPELINE_STEPS = (workflowName: string) => [
  { name: 'strategy', description: 'Growth strategy & positioning', agent: 'ceo', status: 'in_progress', started_at: new Date().toISOString() },
  { name: 'research', description: 'Market & competitor research', agent: 'research', status: 'pending' },
  { name: 'content', description: 'Content plan & copy', agent: 'content', status: 'pending' },
  { name: 'design', description: 'Creative & design system', agent: 'design', status: 'pending' },
  { name: 'build', description: 'Website & tech build', agent: 'engineering', status: 'pending' },
  { name: 'campaign', description: 'Ad campaigns & launch', agent: 'social', status: 'pending' },
  { name: 'outreach', description: 'Sales outreach & leads', agent: 'sales', status: 'pending' },
  { name: 'review', description: 'QA review & handoff', agent: 'ops', status: 'pending' },
];
