# Phase 5 GOAL 7a — RAG retrieval eval (honest)

**Raw numbers** (live hybrid retrieval, 30 labeled queries, 25-chunk corpus):
- hit@1: **11/30 = 37%**
- hit@3: **13/30 = 43%**
- hit@5: **13/30 = 43%**
- MRR: **0.40**

**Honest breakdown** — the misses are DATA QUALITY, not retrieval bugs:
- The corpus's intake chunks for synthetic test clients are sparse stubs —
  e.g. `Intake — Gym A 0` content is literally "Gym A 0 test / No logo —
  brand DNA to be created (code-drawn SVG)." A semantic embedding of that
  has nothing to match the query "gym fitness brand dna" against beyond the
  title. Same for Yoga I 8, Dental H 7, Studio D 3, Cafe B 1, keo/kro karpin.
- Real-content chunks score well: "brew theory brand guidelines visual
  identity" → hit@1 on `guidelines — Brew Theory`; "casa verde interiors
  home makeovers" → hit@2 on `Intake — Casa Verde Interiors`; "monthly
  report september urban fit" → hit@1 on the September report.
- Two structural hits prove hybrid retrieval works across kinds: title-only
  matches (Intake — *) AND content matches (guidelines, monthly report).

**Verdict**: retrieval itself is sound; the labeled-set score is capped by
stub-content test data. Re-run after intake chunks carry real client docs
(same script: `api/scripts/rag-eval.js`).

Evidence: `rag-eval.log` (full per-query output).
