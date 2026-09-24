# Spinach OS v6 — Complete System Context & Restoration Guide

**Last Updated:** 2026-09-23  
**Project Root:** `C:\Users\Abhishek\SpinachOS-v4`  
**Status:** Production-functional (8.7/10 health score)

---

## 1. PROJECT OVERVIEW

**Spinach OS** is an autonomous AI company operating system — a "company that runs like a company" with human Director oversight. It combines:

- **Hermes multiplex gateway** (5 profiles) for agent orchestration
- **Custom API** (Express + TypeScript) for business logic, workflows, real-time
- **Supabase** (PostgreSQL + realtime) for persistence
- **Laya routing controller** (FastAPI) for intent classification
- **OmniRoute** (local LLM bridge) for agent execution
- **Next.js + React Three Fiber** frontend with embedded 3D digital twin
- **3 scrapers** (GitHub, HN, Google Maps) for lead generation

**Goal:** Director gives goal → system plans, executes, reports → Director approves → system launches.

---

## 2. INFRASTRUCTURE & SERVERS

| Service | Port | URL | Status |
|---------|------|-----|--------|
| **Frontend (Next.js)** | 3000 | http://localhost:3000 | ✅ Running |
| **API (Express)** | 4000 | http://localhost:4000 | ✅ Running |
| **Laya Routing** | 8000 | http://localhost:8000 | ✅ Running |
| **OmniRoute (Hermes)** | 20128 | http://localhost:20128 | ✅ Running |
| **Supabase** | — | https://snuvnlxlhvwmzqzbffjz.supabase.co | ✅ Connected |

### Startup Commands
```bash
# Terminal 1: API
cd C:/Users/Abhishek/SpinachOS-v4/api && npm run dev

# Terminal 2: Frontend
cd C:/Users/Abhishek/SpinachOS-v4/frontend/command-center && npm run dev

# Terminal 3: Laya
cd C:/Users/Abhishek/SpinachOS-v4/laya && python -m uvicorn main:app --port 8000

# Terminal 4: Hermes (if not running)
hermes gateway start
```

---

## 3. HERMES PROFILES (5 Departments)

All profiles use **nemotron-3-ultra** via NVIDIA provider on OmniRoute bridge (`localhost:20128`).

| Profile | Role | Key Capabilities |
|---------|------|------------------|
| `ceo` | Strategy, approval gate, 5-question filter | High-level planning, go/no-go |
| `cto` | Task breakdown, tool selection, architecture | Technical planning |
| `orchestrator` | Kanban, delegation, monitoring | Workflow coordination |
| `research` | Market intel, competitor monitoring, trends | Data gathering |
| `social` | X/LinkedIn content, ads, campaigns | Content + distribution |

**Agency-agents plugin** enabled on all profiles (279 specialists across 18 divisions).

---

## 4. DATABASE (SUPABASE)

**Project:** `snuvnlxlhvwmzqzbffjz`  
**Tables (15+):** `clients`, `tasks`, `leads`, `content`, `logs`, `workflows`, `approvals`, `agent_states`, `calendars`, `events`, `channels`, `threads`, `messages`, `scraper_sources`, `scraper_runs`, `telegram_users`, `telegram_webhooks`, `telegram_notifications`, `marketing_content_calendar`, `marketing_engagement`, `daily_runs`

**Critical Fix Required (run once in Supabase SQL Editor):**
```sql
-- File: supabase/fix-agent-states-profile-check.sql
-- Allows dynamic agent profiles (dept_* prefix) to be inserted
```

**RLS:** Service-role bypass policies on all tables  
**Realtime:** Enabled on `messages`, `events`, `channels`, `threads`, `scraper_sources`, `scraper_runs`, `telegram_users`, `telegram_notifications`

---

## 5. API ENDPOINTS (68 routes, ~1900 lines)

### Core Commands
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/command` | Main entry — natural language → Laya routing → execution |
| POST | `/api/v1/agents/execute` | Direct agent task execution via OmniRoute |
| GET | `/api/v1/laya/route` | Direct Laya routing test |
| GET | `/api/v1/laya/health` | Laya connectivity check |

### Workflows & Approvals
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/workflows` | List workflows (14 active) |
| POST | `/api/v1/workflows` | Create workflow (client_pipeline = 8 steps) |
| GET | `/api/v1/workflows/:id` | Get workflow with steps |
| POST | `/api/v1/workflows/:id/advance` | Advance step (sequence enforced) |
| GET | `/api/v1/approvals/pending` | Pending approvals |
| POST | `/api/v1/approvals/:id/approve` | Approve |
| POST | `/api/v1/approvals/:id/reject` | Reject |

### Agents & HR
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/agent-states` | Live agent states |
| GET | `/api/v1/hr/agents` | All agents (12 active) |
| POST | `/api/v1/hr/hire` | Hire new agent |
| POST | `/api/v1/hr/agent-message` | Inter-agent messaging |
| POST | `/api/v1/hr/bulk-action` | Start/stop/pause department |

### Calendar & Comms
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/v1/calendar/events` | CRUD events |
| GET/POST | `/api/v1/calendar/calendars` | CRUD calendars |
| GET | `/api/v1/calendar/agent-schedule/:profile` | Agent schedule |
| POST | `/api/v1/calendar/standup` | Schedule standup (deduped) |
| GET/POST | `/api/v1/comms/channels` | Channels |
| GET/POST | `/api/v1/comms/threads` | Threads |
| GET/POST | `/api/v1/comms/messages` | Messages (XSS sanitized) |

### Scrapers & Leads
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/leads` | All leads (66 total) |
| GET | `/api/v1/scraper/sources` | Scraper configs (3 active) |
| POST | `/api/v1/scraper/ingest` | Ingest leads (deduped) |
| POST | `/api/v1/scraper/run/:sourceId` | Trigger scraper run |

### Marketing
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/v1/marketing/calendar` | Content calendar |
| POST | `/api/v1/marketing/calendar/generate-week` | Generate 70 slots |
| GET | `/api/v1/marketing/engagement` | Analytics |
| POST | `/api/v1/marketing/engagement/record` | Record metrics |

### Telegram
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/telegram/webhook` | Bot webhook |
| GET | `/api/v1/telegram/commands` | Help text |

### Auth & Utility
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/auth/token` | Mint 24h JWT |
| GET | `/api/v1/health` | Health check |

---

## 6. FRONTEND ROUTES (9 + 11 redirects)

| Route | Page | Description |
|-------|------|-------------|
| `/` | **Office** | 3D command center (hero) |
| `/approvals` | Approvals | Queue table, inline actions |
| `/projects` | Projects | Pipeline bars + leads table |
| `/agents` | Agents | Grid + hierarchy |
| `/comms` | Chat | Slack-style channels |
| `/calendar` | Calendar | Week/Month/Agent views |
| `/marketing` | Marketing | Tabs: Calendar \| Engagement |
| `/analytics` | Insights | Stats + Audit Log tab |
| `/settings` | Settings | Integrations, Theme, Brand & Assets |

**Redirects (307):** `/office→/`, `/team→/agents`, `/clients→/projects`, `/logs→/analytics`, `/marketing/calendar→/marketing`, `/marketing/engagement→/marketing`, `/assets→/settings`, `/finance→/analytics`, `/knowledge→/settings`, `/terminal→/`, `/kanban→/projects`

---

## 7. 3D OFFICE SPECIFICATIONS

**Source:** `spinach-3d-office.html` (1751 lines, fully procedural, zero external GLB deps)

### Architecture (46×34m, ceiling 5.2m)
- **Zones (11):** shell, reception, ceo-cabin, research-cabin, lounge, engineering, marketing, design, operations, clients, cafe, lighting-rig, walkers
- **Floor:** Concrete procedural texture (12×9 repeat)
- **Walls:** North slogan, west solid, east/south glazing with mullions
- **Ceiling:** Beams + 6 skylights
- **Glass partitions:** Black metal frames, 28% opacity

### Furniture (all procedural)
- **Desks:** Bench runs (4-seater), work pods (4), cabin desks, conference table (8)
- **Chairs:** Task chairs (oak frame, mesh back, 5-star base), sofas, armchairs, bar stools
- **Accessories:** Keyboards, mugs, notebooks, pens, monitor screens (code/chart/design/video)
- **Plants:** Monstera, fiddle-leaf, topiary, bushy trees, succulents, planter boxes, living walls, hanging plants
- **Reception:** Curved desk, brand wall, "hello" sign
- **Cafe:** 6m counter, espresso machine, pastries, menu board, bar stools

### NPCs (25 people, designer-toy style)
- **Seated (18):** 6 WS-driven (ceo, cto, sales, content, design, engineering)
- **Standing (2):** Walking paths
- **Cabin (5):** Meeting room alternating states
- **Animations:** Sitting, Idle, Wave, No — mapped to agent states
- **Scale:** 0.015 (fixes 100x GLB scale trap)

### Lighting & Camera
- **Day rig:** Hemisphere (0.75) + Directional sun (1.6, 2048 shadows) + 6 pendant points
- **Night rig:** Dim sun (0.25), pendant intensity 30, dark background #0e1420
- **Camera presets:** Aerial, Reference View, Reception, Desk Field, Lounge, Cafe, Top-down
- **Zone click:** 0.8s eased lerp to zone center

### Branding Textures
- `brandLockupTexture` — stacked "spinach" + green dot + "labs"
- `brandWallTexture` — timber slats + mounted lockup
- `sloganWallTexture` — "A quieter, brighter tomorrow."
- `statementTexture` — zone slogans

---

## 8. LAYA ROUTING CONTROLLER

**Service:** FastAPI on `:8000` (`C:\Users\Abhishek\SpinachOS-v4\laya\main.py`)

### Endpoints
- `POST /decide` — `{message} → {department, priority, confidence, tasks[]}`
- `GET /health` — connectivity check

### Classification Logic
- **System 1 (regex):** Keyword counting per department, tie-break → marketing/content
- **Confidence override:** Engineering ≥2 matches → 0.85+
- **Multi-intent:** Splits compound commands → multiple task objects
- **System 1.5 (LLM fallback):** Confidence < 0.5 → LLM call (OpenAI-compatible)
- **Strategy bypass:** "should we", "strategy", "idea", "plan", "evaluate" → CEO directly

### Priority
- `high` → immediate + urgent feed
- `medium` → normal
- `low` → queue

### Department Mapping
```
engineering → engineering
marketing → social
design → design
sales → sales
content → content
research → research
operations → ops
```

---

## 9. COMMAND GATEWAY & TASK RUNS

### Command Gateway (bottom pill on Office page)
- **Voice:** Web Speech API (en-IN), live transcript, auto-send
- **Text:** Natural language → `/api/v1/command`
- **Log:** Conversation history with timestamps

### Task Runs Panel (bottom-right pill → right drawer)
- Lists 30 most recent task runs
- Status dots: running (blue), done (green), blocked (red)
- **Click → full output render** (text + image URLs if present)
- Auto-refresh 15s

---

## 10. DESIGN SYSTEM V6 (Light-First Editorial)

### Colors
```css
--bg-canvas: #080A09;           /* deep charcoal shell */
--bg-page: #FAFAF7;             /* warm off-white content */
--bg-surface: #FFFFFF;          /* cards */
--bg-surface-hover: #F5F5F0;
--border-subtle: rgba(10,10,10,0.06);
--border-strong: rgba(10,10,10,0.15);
--accent-teal: #004B63;         /* primary interactive */
--accent-green: #56883E;        /* status dots only */
--text-primary: #0A0A0A;
--text-secondary: #40403A;
--text-muted: #78786E;
```

### Typography
- **Primary:** `Plus Jakarta Sans` (400/500/600/700)
- **Editorial:** `Playfair Display` (italic for quotes)
- **Mono:** `JetBrains Mono`

### Key Components
- `.card` — surface + subtle border + inner glow
- `.btn` — 5 variants (primary, secondary, ghost, danger, pill)
- `.badge` — state dots (green/amber/blue/violet/red)
- `.kbd` — keyboard shortcuts
- Glassmorphism: `backdrop-blur-xl`, `bg-white/70`

---

## 11. KEY UI COMPONENTS

### Office Page (`/`)
- **LeftNav** (240px): Logo + 9 nav items + brand card
- **TopBar:** Greeting + Search (⌘K) + Bell + Profile + Editorial quote
- **SubTabs:** Overview | Projects | Agents | Team | Clients | Growth
- **KPI Row:** 5 metric cards (Projects, Tasks, Agents, Clients, Growth)
- **3D Hero:** Full-width canvas + floating department badges (6)
- **Bottom Grid (4):** Project Progress, Recent Outputs, Calendar, Editorial Card
- **Right Rail (340px):** Today's Schedule, AI Agents (20 Online), Live Activity
- **Command Gateway:** Bottom pill (voice + text + log)
- **Task Runs:** Bottom-right pill → right drawer

### Approvals Page
- Stats row: Pending | Approved | Rejected | Total
- Queue table with inline Approve/Reject
- Bulk actions bar

### Agents Page
- Grid: state dot, name, dept, role, current task, progress
- Hierarchy view (absorbed from Team)
- Detail drawer on click

### Chat Page
- Channels sidebar (public/private)
- Thread view with @mention autocomplete
- Composer with optimistic send

### Calendar Page
- Week/Month/Agent views
- Standup scheduling button
- Agent filter

### Marketing Page
- Tabs: Content Calendar | Engagement
- Calendar: drag-resize slots, platform filter
- Engagement: KPI cards, platform charts, top posts table

### Projects Page
- Workflows: 8-step segmented progress bars + %
- Leads table by source
- 30s auto-refresh

### Insights Page
- Stats cards: Working, Blocked, Success Rate, Avg Duration
- Agent states visualization
- **Audit Log tab** (filterable, virtualized)

### Settings Page
- Integrations (Supabase, Telegram, Laya, OmniRoute)
- Theme toggle (light/dark, persists)
- API Keys (masked)
- **Brand & Assets:** Logo variants, font specimens

---

## 12. WEB SOCKET EVENTS

**Single connection:** `ws://localhost:4000/ws` (via `wsStore.ts`)

| Event | Payload | Consumers |
|-------|---------|-----------|
| `agent_state` | `{profile, state, activity}` | Status strip, Agent cards, 3D NPCs |
| `task_update` | `{taskId, status, progress, output}` | Task Runs, Project bars |
| `feed` | `{type, message, timestamp}` | Live Activity, System Logs |
| `approval` | `{id, status, title}` | Approvals page, strip badge |
| `workflow` | `{id, step, progress}` | Projects page |
| `zone_focus` | `{zoneId, agents[]}` | Right sidebar, 3D camera |

---

## 13. SCRAPER FLEET (3 scripts)

| Script | Source | Schedule | Leads |
|--------|--------|----------|-------|
| `scrape_github.py` | GitHub Trending | Daily 6am IST | 10 |
| `scrape_hackernews.py` | HN "Who's Hiring" | Daily 7am IST | 39 |
| `scrape_google_maps.py` | Google Maps (gyms/dental/salons Mumbai) | Daily 8am IST | 15 |

**Total leads:** 66 in DB (deduped via `/api/v1/scraper/ingest`)

---

## 14. WORKFLOW ENGINE

**Client Pipeline (8 steps):**
1. `strategy` — CEO creates growth strategy
2. `task_breakdown` — CTO breaks into tasks
3. `lead_generation` — Sales generates leads
4. `content_creation` — Content creates posts/scripts
5. `design_assets` — Design creates visuals
6. `engineering_build` — Engineering builds tech
7. `approval_review` — Director reviews (approval queue)
8. `launch` — Ops launches and monitors

**Rules:**
- Sequence enforced (409 if out-of-order)
- Auto-approval creation on step 7
- Completion = status `completed`, progress 100%
- Real LLM execution via OmniRoute per step

---

## 15. KNOWN ISSUES & FIXES APPLIED

| Issue | Fix | Status |
|-------|-----|--------|
| Pipeline stuck at 88% | Removed `completed_at` from update; added error throw | ✅ |
| Steps advanced out-of-order | Sequence validation + 409 | ✅ |
| `/approvals/pending` returned clients | Removed duplicate route | ✅ |
| "Office is offline" false negative | CommandGateway auth header + real JWT | ✅ |
| Scraper runs never created | `/ingest` auto-creates run record | ✅ |
| XSS in comms | `sanitizeText()` on messages + commands | ✅ |
| Standup duplicates | 9AM ±1h window dedupe | ✅ |
| JWT never expired | `jwt.verify()` + `/auth/token` 24h tokens | ✅ |
| Fake frontend token | `src/lib/auth.ts` mints/caches/refreshes | ✅ |
| LeftNav no navigation | `useRouter()` + `usePathname()` | ✅ |
| Hire silently failed | SQL constraint fix + error surfacing | ⚠️ SQL pending |
| `daily_runs` upsert chain error | Loop of separate upserts | ✅ |
| `GET /clients` 404 | Added endpoint | ✅ |
| `emitAgentState` not persisted | Now writes to `agent_states` table | ✅ |
| Non-Laya commands untracked | All commands create tasks | ✅ |
| Task lookup 500 | UUID regex + 404 | ✅ |
| Hire columns wrong | dept/role → metadata | ✅ |
| `hire` Laya-routed | Bypass in Laya classifier | ✅ |
| Double WS connection | OpsSidebar → single spinach-store | ✅ |

---

## 16. FILE STRUCTURE (KEY PATHS)

```
SpinachOS-v4/
├── api/
│   ├── src/index.ts                 # Main API (1900 lines)
│   ├── package.json
│   └── .env                         # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET
├── frontend/command-center/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx           # AppShell
│   │   │   ├── page.tsx             # Office (3D + dashboard)
│   │   │   ├── approvals/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── agents/page.tsx
│   │   │   ├── comms/page.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── marketing/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── shell/               # AppShell, LeftNav, TopBar, OpsSidebar
│   │   │   ├── office/              # OfficeSceneV2, DepartmentBadges, TaskRunsPanel
│   │   │   ├── dashboard/           # KPIRow, ProjectProgress, RecentOutputs, Calendar, EditorialCard
│   │   │   ├── ops/                 # TodaySchedule, AIAgentDirectory, LiveActivity
│   │   │   ├── approvals/           # ApprovalQueue, ApprovalRow
│   │   │   ├── agents/              # AgentGrid, AgentHierarchy
│   │   │   ├── comms/               # ChannelSidebar, ThreadView, Composer
│   │   │   ├── marketing/           # ContentCalendar, EngagementCharts
│   │   │   ├── projects/            # PipelineBars, LeadsTable
│   │   │   ├── analytics/           # StatsCards, AuditLog
│   │   │   ├── settings/            # Integrations, Theme, BrandAssets
│   │   │   └── ui/                  # Button, Card, Badge, Input, etc.
│   │   ├── lib/
│   │   │   ├── auth.ts              # getAuthToken, apiFetch
│   │   │   ├── office/scene-v2/     # 3D engine modules (8 files)
│   │   │   ├── office/hooks/        # useOfficeScene, useZoneClick
│   │   │   ├── wsStore.ts           # Zustand + WS
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   ├── store/
│   │   ├── styles/globals.css       # Design system V6
│   │   └── types/
│   ├── public/
│   │   ├── brand/                   # SVG logos
│   │   ├── fonts/                   # Satoshi TTFs
│   │   ├── env/office_env_1k.hdr    # HDRI
│   │   └── models/furniture/        # 17 GLBs from Hermes3D
│   └── package.json
├── laya/
│   ├── main.py                      # FastAPI routing controller
│   └── requirements.txt
├── automation/
│   ├── scraper/
│   │   ├── scrape_github.py
│   │   ├── scrape_hackernews.py
│   │   ├── scrape_google_maps.py
│   │   └── scraper_token.txt        # Director JWT for scrapers
│   └── operations/
├── supabase/
│   ├── schema.sql                   # Full schema (8 core + 15 extended)
│   └── fix-agent-states-profile-check.sql  # **RUN THIS IN DASHBOARD**
├── DEEP-QA-REPORT.md
├── V6-FINAL-REPORT.md
├── FRONTEND-REDESIGN-PLAN.md
├── SYSTEM-AUDIT-REPORT.md
└── CONTEXT.md (this file)
```

---

## 17. ENVIRONMENT VARIABLES

### API (`api/.env`)
```env
PORT=4000
SUPABASE_URL=https://snuvnlxlhvwmzqzbffjz.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG... (from Supabase Dashboard → Settings → API)
JWT_SECRET=your-256-bit-secret
FRONTEND_URL=http://localhost:3000
```

### Frontend (`.env.local` — optional)
```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_LAYA_URL=http://localhost:8000
```

### Laya (`laya/.env` — optional)
```env
OMNIROUTE_URL=http://localhost:20128
```

---

## 18. VERIFICATION CHECKLIST (Current State)

- [x] TypeScript: 0 errors
- [x] All 9 routes + 11 redirects → HTTP 200
- [x] Office page: 3D renders, badges clickable, WS live
- [x] Command Gateway: voice + text → Laya → agent execution → Task Runs panel shows output
- [x] Approvals: inline approve/reject works
- [x] Agents: grid + hierarchy, hire works (after SQL fix)
- [x] Chat: channels, threads, @mentions
- [x] Calendar: standup scheduling
- [x] Marketing: calendar + engagement tabs
- [x] Projects: pipeline bars + leads table
- [x] Insights: stats + audit log tab
- [x] Settings: Brand & Assets section
- [x] Light/dark toggle: UI + 3D flip
- [x] Theme persists localStorage
- [x] Status strip: LIVE, counts correct
- [x] Task Runs panel: click run → full output + images
- [x] Pipeline full 8/8 completion verified
- [x] 10 concurrent commands → all 200, zero 429

---

## 19. NEXT STEPS (Priority Order)

1. **Run SQL fix** in Supabase dashboard: `supabase/fix-agent-states-profile-check.sql`
2. **Verify hires persist** after restart
3. **Wire scrapers to Hermes cron** (daily 6/7/8am IST on research profile)
4. **Engagement polling cron** for published posts
5. **Telegram bot token** (add to Hermes vault → activate webhook replies)
6. **Persist agent registry** to Supabase table
7. **Real Hermes cron integration** (replace mock endpoints)
8. **Kill-by-name restart script** for API
9. **tsconfig for api/** (fix 4 runtime-safe import errors)
10. **Warm re-skin remaining dark pages** (agents/comms/calendar/settings)

---

## 20. RESTORATION PROCEDURE

If starting fresh in a new session/harness:

1. **Read this file** — complete context restored
2. **Run servers** (4 terminals as shown in Section 2)
3. **Run SQL fix** in Supabase dashboard
4. **Verify** at http://localhost:3000
5. **Test command:** "start pipeline for Test Client" → watch 3D NPCs execute

---

## 21. KEY CONTACTS & CREDENTIALS

- **Supabase Dashboard:** https://supabase.com/dashboard/project/snuvnlxlhvwmzqzbffjz
- **Supabase SQL Editor:** https://supabase.com/dashboard/project/snuvnlxlhvwmzqzbffjz/sql
- **Hermes Desktop App:** Local (profiles: ceo, cto, orchestrator, research, social)
- **OmniRoute:** http://localhost:20128
- **Hermes3D Assets Repo:** https://github.com/iamlukethedev/Hermes3D/tree/main/public/office-assets

---

**End of Context File** — This document contains everything needed to understand, continue, or transfer the Spinach OS v6 project.