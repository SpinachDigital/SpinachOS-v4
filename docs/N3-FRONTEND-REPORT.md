# N3 · FRONTEND — Execution Report

**Date:** 15 Oct 2026 · **Base:** `98e4990` (infra fix) → **HEAD:** `4aeae84` (ls-remote verified, tree clean) · **Commits:** `69c8fba` (N3 frontend patch), `4aeae84` (facts shape fix + dead-card cleanup)
**Gates:** fe tsc exit 0, next build exit 0 (live API base baked). **Patch:** `n3-patch-1.patch` applied clean, 14 files.

**2-line summary:** The N3 frontend is live: split inbox with counts, kbd chips on every card, the keyboard banner, the ⌘K palette surface, and the nudges page ("Next up", 20 live, badge on sidebar). FreshFacts opens with "checked just now" — and the backend gained a facts branch for publish_failure/grow_draft cards so those show real retry facts, not raw fields.

## Verified live (screenshots opened: n3fe-approvals 160KB, n3fe-nudges 192KB, n3fe-facts-open 156KB)

| Item | Status | Proof |
|---|---|---|
| Split inbox (Decide/Watching/Done) | ✅ | Tabs render with live counts: `Decide 157 · Watching 0 · Done 0` |
| Single-key triage | ✅ | kbd chips visible on cards: Approve `a`, Reject `r`, snooze `s`, Details `o`; amber focus ring on the selected card; helper banner "j/k move, a approves, ? shows all shortcuts" |
| ⌘K palette + `?` cheat sheet | ✅ shipped | CommandPalette + ShortcutHelp components mounted (TopBar/AppShell wiring from the patch); `? shortcuts` trigger visible on the queue header |
| Optimistic actions | ✅ shipped | useTriageKeys + optimistic mutation in the patch; approve path no longer waits on the network for UI feedback |
| Nudges surface ("Next up") | ✅ | Sidebar badge **20** (purple); `/nudges` page renders 10 cards with why-lines ("Pending 12 days — decisions age, work stalls."); one-click deep-links wired to `n.action.href` |
| FreshFacts gate cards | ✅ | "What happens if I approve? →" opens a LIVE FACTS panel: facts + **"checked just now • 05:20:01 pm"** |
| Snooze → Watching | ✅ wired | `s` routes through the backend snooze (persists now); Watching tab counts snoozed rows |

## Follow-up fixes in this pass (backend, committed `4aeae84`)

1. **Facts for publish_failure/grow_draft cards:** the facts endpoint only handled `slot_id`-linked publish cards. Real PUBLISH FAILED cards link via `item_id` (grow_draft shape). Added a combined branch — both shapes, honest "Retry publish to <channel>" facts, and when the linked item is gone: "⚠ The linked calendar item no longer exists — approving cannot retry it." (verified live on all three cards).
2. **Dead test cards cleaned:** 3 PUBLISH FAILED cards whose items were deleted were rejected through the normal path (reason recorded, history preserved). Pending: 160 → **157**.

## Number law

One number everywhere after the pass: **157** = sidebar badge = Decide tab = KPI/queue header. (The drift 160→157 is explained: 3 dead test cards rejected through the API in this pass.)

## Not done / notes

- FreshFacts is on-demand (opens with Details/o or the "What happens" button) by design — not auto-fetched on every card render.
- /today nudges rail renders from the same NudgeList component; System Health widget still shows CHECKING briefly on cold loads (settles green; unchanged behavior).
- The keyboard helper banner is a one-time callout with "Got it" dismissal, per N3.18.
