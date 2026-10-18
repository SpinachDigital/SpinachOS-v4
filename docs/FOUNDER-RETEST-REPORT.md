# FOUNDER RETEST — Full OS Walkthrough as Abhishek

**Commit `a5446b8` on origin/main.** Wore the founder hat end-to-end: every server restarted fresh, JWT re-minted, 20 pages screenshotted, 6 pages vision-reviewed as "non-technical founder", 5 live flows exercised (command, reject, nudges, health, grow). Found 1 infra bug, 6 founder-pain issues; all fixed and verified.

## Live flows (founder actions, real API calls)

| Flow | Action | Result |
|---|---|---|
| Command | POST orchestrator "what is the Spinach OS mission?" | 200 → task `2614705b` done in 26s via gateway lane, answer in task_outputs: "mission unknown — not on file" (company brief gap, known) |
| Decide | Reject Fitness Factory lead (8/100) with reason | 200, pending 50→49 |
| Nudges | Open Next up | 20 nudges, 224h-stuck pipeline first (severity sort works) |
| Health | System check | DB ok 53ms, Laya ok, Agent Engine ok (OmniRoute), WS ok, API uptime |
| Grow | Calendar state | 71 ideas / 2 drafts / 1 failed (Publora 404 reason renders) / 4 published |

## Infra bug found during retest

- **Stale API processes on :4000 again** (2 old listeners serving pre-fix code). Killed, fresh restart. This is the third occurrence — pattern: background `npx tsx` processes survive FE/API rebuild cycles. Recommendation: restart script should kill by port before start.

## Founder-pain issues fixed (commit `a5446b8`)

| Page | What Abhishek saw | Fix | Verified |
|---|---|---|---|
| Home KPIs | "↑ live", "↑ now", "● real DB count" — dev-speak on stat cards | Plain deltas: "ready to work", "action needed", "none yet" | API: stats now render plain |
| Team | 10 LOW "idle 24h" flags in a screaming RED box = fake emergency | Red reserved for HIGH/MEDIUM; LOW idles → one gray line "10 agents waiting for assignments — dispatch work from Chat" | Vision: calm gray note, no red box |
| Team | Cryptic "q0 √0/wk" metrics | "0 queued · 0 done this week" | Vision: plain words |
| Grow | 73 OVERDUE badges — a wall of amber noise from a month-old backlog | Old ideas (>7d) → quiet "planned, never generated"; badge only on actionable items | DOM: 70 quiet, 3 OVERDUE |
| Approvals | Card said the same text twice (description + draft body verbatim) | Deliverable box hidden when body repeats description | Code + dedupe logic |
| Approvals | Raw "lead_qualified" snake_case tag | "New lead" (Users icon) + Content draft / Publish / Stage gate labels | DOM: 48× "New lead", 0 raw |
| Leads | "chocks · · hackernews" — dangling separator on empty email | Parts joined only when non-empty | DOM: 0 double separators |

## Vision review notes (founder lens, pages reviewed: today, home, leads, approvals, team, grow)

- Home 404 scare was a headless hydration race — real render is fine (stats, 3D office, zones all present). Right-rail skeletons in screenshots are the headless no-token case; `/api/schedule/today` and `/api/agents` both 200 with data.
- Founder verdict on Today page: "I am the bottleneck — 50 approvals stalled, agents idle." That is honest UX, working as designed.
- Recurring theme in reviews: **test prompts in agent activity** ("what is 2+2", "Hi ek Naya website") look unprofessional. Task titles are filterable but the activity strings in RightRail/Team still surface them. Roadmap: filter test-noise from `activity` strings globally.
- "Morning standup at 02:30 PM" — schedule seeds are placeholder times. Roadmap: real schedule seeding.
- AI "CEO" agent + human "Founder" both exist — naming overlap confuses. Roadmap: rename agent to "Chief of Staff".

## Gates

- fe tsc 0 · api tsc 0 · next build 0 (31/31) · all pages 200
- Key-leak grep on diff: clean

## Files changed

`api/src/routes/dashboard.ts`, `frontend/.../app/grow/page.tsx`, `app/leads/page.tsx`, `app/team/page.tsx`, `components/ApprovalQueue.tsx` — 5 files, +77/−29.
