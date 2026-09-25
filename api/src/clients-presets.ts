/*
 * clients-presets.ts — PACKAGE_PRESETS (Phase 3 split from index.ts L938–995).
 */
export const PACKAGE_PRESETS: Record<string, any> = {
  brand_identity: {
    key: 'brand_identity', name: 'Brand Identity', price_inr: 14999, billing: 'one_time',
    description: 'Logo + guidelines + brand DNA. Code-drawn SVG only.',
    steps: [
      { name: 'intake', agent: 'orchestrator' },
      { name: 'classify', agent: 'orchestrator' },
      { name: 'dna_extract', agent: 'designer' },
      { name: 'logo_design', agent: 'designer' },
      { name: 'guidelines', agent: 'designer' },
      { name: 'hod_qa', agent: 'designer' },
      { name: 'approve', agent: 'director' },
      { name: 'deliver', agent: 'ops' },
    ],
  },
  digital_launch: {
    key: 'digital_launch', name: 'Digital Launch', price_inr: 24999, billing: 'one_time',
    description: 'Website + content + SEO/GMB setup + launch.',
    steps: [
      { name: 'intake', agent: 'orchestrator' },
      { name: 'strategy', agent: 'ceo' },
      { name: 'website', agent: 'engineer' },
      { name: 'content', agent: 'social' },
      { name: 'seo_setup', agent: 'seo_specialist' },
      { name: 'gmb', agent: 'seo_specialist' },
      { name: 'hod_qa', agent: 'orchestrator' },
      { name: 'approve', agent: 'director' },
      { name: 'deliver', agent: 'ops' },
    ],
  },
  growth: {
    key: 'growth', name: 'Growth', price_inr: 19999, billing: 'monthly',
    description: 'Monthly retainer: content + design + SEO + report.',
    steps: [
      { name: 'content_plan', agent: 'social' },
      { name: 'content_creation', agent: 'social' },
      { name: 'design_assets', agent: 'designer' },
      { name: 'seo_check', agent: 'seo_specialist' },
      { name: 'monthly_report', agent: 'research' },
      { name: 'approve', agent: 'director' },
      { name: 'deliver', agent: 'ops' },
    ],
  },
  scale: {
    key: 'scale', name: 'Scale', price_inr: 39999, billing: 'monthly',
    description: 'Growth + paid media (auto-activates ads_manager).',
    steps: [
      { name: 'content_plan', agent: 'social' },
      { name: 'content_creation', agent: 'social' },
      { name: 'design_assets', agent: 'designer' },
      { name: 'seo_check', agent: 'seo_specialist' },
      { name: 'ads_manage', agent: 'ads_manager' },
      { name: 'monthly_report', agent: 'research' },
      { name: 'approve', agent: 'director' },
      { name: 'deliver', agent: 'ops' },
    ],
  },
};
