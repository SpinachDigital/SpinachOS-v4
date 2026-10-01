# SPRINT 6 EVIDENCE — "Living Office"

All acceptance claims are proven by these committed files (EVIDENCE DISCIPLINE).

| file | claim it proves |
|---|---|
| `labels-initial-1440.png` | Diorama renders (native module, no iframe) + `labels on` toggle + lighting toggles + floating HTML labels visible per agent zone |
| `labels-live-tasks-1440.png` | Labels show LIVE task text from /api/v1/hr/roster: Social `✍️ @social draft a one-line announcem...`, Research `✍️ research competitor Haldiram for a...` (green active dot), Orchestrator `✍️ Onboard client "Vertex Realty"...` |
| `after-assign-sales-1440.png` | ACCEPTANCE: task assigned via `POST /api/v1/hr/agent-task` (measured 545ms) → Sales bubble shows the new task `✍️ Living Office probe: qualify 5 Mir...` within ~7s (2s roster poll + 2s RAF throttle) with green working dot |
| `office-390-compact.png` | 390px: compact label mode (dot + name only, <600px viewport), NO overlap, clean layout, no horizontal overflow |

Method: real Chromium via CDP (isolated profile), viewport screenshots through
Page.captureScreenshot; overflow measured via scrollWidth vs clientWidth.
