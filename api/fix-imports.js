// Phase 3 — fix-imports: add the right imports to each extracted route file
// based on which bare symbols it references. Idempotent (skips if already imported).
const fs = require('fs');
const path = require('path');

// symbol → import source module
const CTX = {
  app: null, // routes receive `app` via a register function — see below
  authMiddleware: '../ctx',
  supabase: '../ctx',
  JWT_SECRET: '../ctx',
  JWT_EXPIRES_IN: '../ctx',
  JwtPayload: '../ctx',
  wsClients: '../ctx',
  broadcast: '../ctx',
  emitFeed: '../ctx',
  emitAgentState: '../ctx',
  emitTaskUpdate: '../ctx',
  emitApproval: '../ctx',
  emitWorkflow: '../ctx',
  emitTaskLifecycle: '../ctx',
  sanitizeText: '../ctx',
  ChatSchema: '../ctx',
  AgentSearchSchema: '../ctx',
  AgentLoadSchema: '../ctx',
  ApprovalActionSchema: '../ctx',
  HireAgentSchema: '../ctx',
  AgentMessageSchema: '../ctx',
  BulkAgentActionSchema: '../ctx',
};
const ENGINES = {
  resolvePath: '../bridge',
  runProfileTask: '../bridge',
  runSpecialistTask: '../bridge',
  runGatewayTask: '../bridge',
  getBreakerStates: '../bridge',
  getFallbackLog: '../bridge',
  recordGatewayFailure: '../breaker-telemetry',
  recordGatewaySuccess: '../breaker-telemetry',
  gatewayBreakerAllows: '../breaker-telemetry',
  recordFallback: '../breaker-telemetry',
  embed: '../rag',
  EMBED_DIMS: '../rag',
  hybridRetrieve: '../knowledge-helper',
  runAgentTask: '../engines/agent-execution',
  executeAgentTask: '../engines/agent-execution',
  AGENT_MODELS: '../engines/agent-execution',
  AGENT_SYSTEM_PROMPTS: '../engines/agent-execution',
  OMNIROUTE_URL: '../engines/agent-execution',
  AGENT_TASK_TIMEOUT_MS: '../engines/agent-execution',
  // pipeline engine parts
  buildStepPrompt: '../engines/pipeline-run',
  runHodQa: '../engines/pipeline-run',
  runPipeline: '../engines/pipeline-run',
  QA_GATE_STEPS: '../engines/pipeline-qa',
  QA_OWNER: '../engines/pipeline-qa',
  runningPipelines: '../engines/pipeline-qa',
  client_id_exists: '../engines/pipeline-qa',
  mapApprovalType: '../engines/pipeline-qa',
  collectStepOutputs: '../engines/pipeline-qa',
  persistSteps: '../engines/pipeline-qa',
  stepKindFor: '../engines/pipeline-qa',
  dispatchStep: '../engines/pipeline-run',
  BRAND_VOICES: '../engines/pipeline-run',
  DEFAULT_PIPELINE_STEPS: '../engines/pipeline-qa',
  PACKAGE_PRESETS: '../clients-presets',
  provisionDormantAgent: '../dormant',
  hibernateDormantAgent: '../dormant',
  // command/laya internals
  IRREVERSIBLE: '../command-intent',
  COMPLEX_SIGNALS: '../command-intent',
  needsBrainstorm: '../command-intent',
  dispatchReply: '../command-intent',
  handleCommandThread: '../command-thread',
  delegatePlan: '../command-thread',
  ensureWorkflowChannel: '../warroom-helpers',
  warRoomPost: '../warroom-helpers',
  specialCommandHandler: './special-handler',
  LAYA_URL: '../laya-client',
  LayaDecision: '../laya-client',
  LAYA_DEPARTMENT_MAP: '../laya-client',
  CEO_KEYWORDS: '../laya-client',
  callLaya: '../laya-client',
  isCEOQuery: '../laya-client',
  HTML_TAG_RE: '../ctx',
  DANGEROUS_PROTO_RE: '../ctx',
  EVENT_HANDLER_RE: '../ctx',
  // dashboard helpers
  AGENT_ICONS: '../dashboard-helpers',
  DEPT_TAG_DEFS: '../dashboard-helpers',
  timeAgo: '../dashboard-helpers',
};

const ROUTE_FILES = fs.readdirSync('src/routes').filter(f => f.endsWith('.ts'));
let patched = 0;
for (const f of ROUTE_FILES) {
  const fp = path.join('src/routes', f);
  let src = fs.readFileSync(fp, 'utf8');
  if (src.includes('// -- imports auto-added')) { /* already done */ }

  // find bare identifiers used (rough scan: word boundaries, skip strings/comments crudely)
  const used = new Set();
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/'[^']*'/g, "''").replace(/`[^`]*`/g, '``');
  for (const sym of Object.keys(CTX).concat(Object.keys(ENGINES))) {
    if (sym === 'app') continue;
    if (new RegExp('\\b' + sym + '\\b').test(code)) used.add(sym);
  }

  // group by module
  const byModule = {};
  for (const sym of used) {
    const mod = CTX[sym] || ENGINES[sym];
    if (!mod) continue;
    (byModule[mod] = byModule[mod] || []).push(sym);
  }

  const importLines = Object.entries(byModule).map(([mod, syms]) =>
    `import { ${[...new Set(syms)].sort().join(', ')} } from '${mod}';`);

  if (importLines.length) {
    // insert after the header comment (before the first code line)
    const lines = src.split('\n');
    let insertAt = 0;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(' */')) { insertAt = i + 1; break; }
    }
    lines.splice(insertAt, 0, '', '// -- imports auto-added by fix-imports (Phase 3)', ...importLines);
    src = lines.join('\n');
    fs.writeFileSync(fp, src);
    patched++;
    console.log('patched', f, '→', importLines.length, 'import lines');
  }
}
console.log(patched + ' files patched');
