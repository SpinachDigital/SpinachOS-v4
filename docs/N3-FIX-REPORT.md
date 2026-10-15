# N3 · FIX PASS — nudge action buttons + deep-link focus

**Date:** 15 Oct 2026 · **Base:** `653773c` → **HEAD:** `2231909` (ls-remote verified, tree clean)
**Patch:** `n3-patch-2.patch` applied clean (2 files: NudgeList.tsx, approvals/page.tsx).
**Gates:** fe tsc exit 0, next build exit 0 (live API base baked), FE restarted on :3000.

**2-line summary:** Nudge action buttons ab render hote hain (`action.target` fallback) — 10/10 cards pe live. Deep-link click `/approvals?focus=<id>` pe land karta hai aur target card amber focus ring ke saath focused hota hai.

## Verify (live, tunnel se)

| Check | Result |
|---|---|
| Action buttons render | ✅ 10/10 cards pe "Open approval" links, href = `/approvals?focus=<id>` |
| Click → landing | ✅ `/approvals` pe land, tab `Decide` |
| Focus + scroll | ✅ target card (**Outreach email — Justworks**, id `ef9d80ea`) pe **amber focus ring** — screenshot 166KB khola, ring clearly visible |
| Param cleanup | ✅ `replaceState` se `focus` param consume ke baad strip — refresh re-jump nahi karega |

## Notes
- Patch chhota aur sahi tha: `n.action?.href || n.action?.target` (NudgeList line 83) + focus effect (approvals page lines 118-138).
- Verification note: pehla URL-probe misleading tha (`focus` param consume ho chuka hota hai) — DOM-level check (data-approval-id + ring class + card identity match) se confirm kiya.
- Evidence: `docs/evidence/n3/n3fix-approvals-focused.png` (gitignored, local).
