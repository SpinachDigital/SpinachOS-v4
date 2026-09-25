/*
 * knowledge-helper.ts — hybridRetrieve (Phase 3 split, from index.ts L1315–1339).
 * Wraps rag.ts embed + the two hybrid RPCs with RRF fusion. No behavior changes.
 */
import { supabase } from './ctx';
import { embed, reciprocalRankFuse } from './rag';

export async function hybridRetrieve(q: string, clientId: string | null, limit = 5): Promise<any[]> {
  // SEMANTIC + LEXICAL in parallel (Phase 4 perf fix)
  const [qvec, lexRes] = await Promise.all([
    embed(q, 'query'),
    supabase.rpc('hybrid_chunks_lexical', { p_query: q, p_client_id: clientId, p_limit: 50 }),
  ]);
  let semanticIds: string[] = [];
  if (qvec) {
    const { data: sem, error: semErr } = await supabase.rpc('hybrid_chunks_semantic', {
      p_query_embedding: qvec,
      p_client_id: clientId,
      p_limit: 50,
    });
    if (!semErr && Array.isArray(sem)) semanticIds = sem.map((r: any) => r.id);
  }
  let lexicalIds: string[] = [];
  if (!lexRes.error && Array.isArray(lexRes.data)) lexicalIds = lexRes.data.map((r: any) => r.id);

  // FUSE (RRF) — top-k
  const fusedIds = reciprocalRankFuse(semanticIds, lexicalIds).slice(0, limit);
  if (fusedIds.length === 0) return [];

  // fetch the fused rows
  const { data: rows, error } = await supabase
    .from('knowledge_chunks')
    .select('id, client_id, scope, kind, title, content, source, created_at')
    .in('id', fusedIds);
  if (error) return [];
  const byId = new Map((rows || []).map((r: any) => [r.id, r]));
  return fusedIds.map(id => byId.get(id)).filter(Boolean) as any[];
}
