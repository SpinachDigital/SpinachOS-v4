# Spinach OS v4 — Marketing OS + Scrapers Build Report (2026-09-22)

## ✅ Marketing OS UI — BUILT & VERIFIED

### Pages
| Page | Route | Features | Status |
|------|-------|----------|--------|
| **Content Calendar** | `/marketing/calendar` | Week + Month grid views, theme color-coding (politics/cricket/ai/github/quote/gita), platform icons (X/LinkedIn/IG/Threads), status badges, filters (theme/platform/status), date picker, 10 slot labels | ✅ HTTP 200 |
| **Engagement Analytics** | `/marketing/engagement` | 6 KPI cards (impressions/likes/retweets/replies/quotes/profile clicks), platform breakdown, SVG trend chart with legend, top-posts table with engagement rate, daily breakdown table, time ranges (24h/7d/30d/90d) | ✅ HTTP 200 |

### LeftNav
- Added "Content Calendar" + "Engagement" entries (17 items total)

### API (Marketing OS — `api/src/index.ts` now ~2,000 lines)
| Endpoint | Method | Purpose | Tested |
|----------|--------|---------|--------|
| `/api/v1/marketing/calendar` | GET | List with date/platform/status/theme filters | ✅ |
| `/api/v1/marketing/calendar` | POST | Upsert slot (onConflict: date,slot_index,platform) | ✅ |
| `/api/v1/marketing/calendar/:id` | PATCH/DELETE | Update/delete slot | — |
| `/api/v1/marketing/calendar/generate-week` | POST | Generates 7 days × 10 slots (70 rows) across themes with times | ✅ **70 created** |
| `/api/v1/marketing/engagement` | GET | Metrics with gte. date filter support | ✅ (4 metrics for x) |
| `/api/v1/marketing/engagement` | POST | Record metrics batch (likes/retweets/replies/impressions) | ✅ |

## ✅ Scraper Scripts — BUILT & **RUN FOR REAL**

### Scripts (`automation/scraper/`)
| Script | Source | Parser | Result |
|--------|--------|--------|--------|
| `scrape_github.py` | GitHub Trending (public page, no auth) | Article Box-row → owner/repo, description, language, stars_today; scores 0-100 (star velocity + hiring keywords + language bonus) | ✅ **8 repos fetched, 8 inserted** |
| `scrape_hackernews.py` | HN Algolia API (no auth) | Latest "Ask HN: Who is hiring?" thread → 40 top-level comments → company/role/location/remote/email extraction | ✅ **39 leads parsed, 39 inserted** |

### Live Results (`leads` table now has 49 leads)
```
Total leads: 49
By source: {"hackernews": 39, "github": 9, "test": 1}
Top by score: browser-use/video-use [70], superdesigndev/treg [70],
              mvt-project/mvt [70], davila7/claude-code-templates [70]
```

### Auth Fix
- Scripts initially sent Supabase service key (not JWT) → API 401
- Fixed: `scraper_token.txt` holds director JWT signed with api/.env JWT_SECRET; both scripts read it via `_token()`

### GitHub Markup Fix
- First parse only caught 1 repo (h2>a[href] pattern missed GitHub's varied markup)
- Fixed: multi-pattern matching (h2 first, then owner/repo-shaped hrefs excluding sponsors/apps/features) → 8/8 repos

## Cron Setup (optional next step)
```bash
# Hermes cron (research profile):
#   daily 6am IST → python automation/scraper/scrape_github.py
#   daily 7am IST → python automation/scraper/scrape_hackernews.py
# Engagement scraping (social profile): needs twitter-cli/browser — poll post metrics → POST /api/v1/marketing/engagement
```

## State
- API :4000 — ~2,000 lines, ~72 endpoints, all tested paths working
- Frontend :3000 — 9 routes live (Dashboard, Approvals, Agents, Logs, Calendar, Comms, Settings, Marketing Calendar, Engagement)
- Frontend TS: 0 errors
- Leads: 49 (39 HN + 9 GitHub + 1 test)
- Content calendar: 70 slots generated (7 days × 10)
