# OPERATOR'S HANDBOOK — Spinach OS v4

*For the human who runs the company on this system. Plain English, no diagrams.*

---

## What this system is

Spinach OS runs your agency end-to-end: it finds leads (WIN), delivers client
work (DELIVER), creates assets (CREATE), publishes content (GROW), and handles
support. AI agents draft and execute. You approve. Nothing leaves the building
without your click.

**The one law: nothing auto-publishes, auto-sends, or auto-files without a
founder-approved card in THE INBOX.** Everything else is machinery.

---

## THE DAILY LOOP

### Morning (10 minutes)

1. **Open `/today`** — the whole company on one screen:
   - 4 numbers: approvals pending, open tickets, new leads, content scheduled.
   - Top 5 inbox cards (triage-scored, highest first) with inline **Approve**.
   - Active pipelines with progress bars.
   - WIN this week / GROW this week counts.
2. **Inbox zero** — go to `/approvals` (or work the cards on /today):
   - **Approve** = the agent's action proceeds (outreach sends, stage advances, deliverable files, content publishes).
   - **Reject** = the action dies, agent is told why (add a reason — the agents learn from it).
   - Cards carry a **style score** (0–10 lint) and gates carry a **risk tier** (read/write/external). A red tier badge means the agent has never done this before on this pipeline — read it twice.
3. **Check tickets** — `/portal/tickets` shows the client queue; reply from the ticket thread. Unread tickets bump to the top of your inbox as cards.

### WIN — finding clients

- New leads land on `/leads` (manual add, CSV import, or scrapers).
- **Qualify** — one click, an agent scores the lead (0–100) and files a
  qualification card. Approve the card → lead becomes `qualified`.
- **Draft outreach** — agent writes the email (style-linted, score on the card).
  Approve the card, then **send** — it goes out through your connected email
  sender (see Key Management below).
- Lead replies → mark **responded** → **Onboard** — one click creates the
  client, their pipeline (Client Onboarding v2), tasks, and a portal invite.
- Honest states: if no email sender is connected, sends queue as
  `pending_send` — never fake-sent. If delivery fails, the draft goes back to
  `pending_send` with the provider's error verbatim.

### DELIVER — running client pipelines

- Every client runs a pipeline (`/pipeline`). Stages advance through
  **gates**: a gate is a founder decision point — approve it in THE INBOX,
  then it **runs** (stage advances, or the deliverable files, or the report
  sends).
- `file_deliverable` gates file the work AND stamp it into the asset library
  automatically (bucket, version, origin). No separate filing step.
- Stuck stages surface as cards. Gates that never ran stay pending — deny
  by default.

### CREATE — the asset library

- `/assets` is every deliverable ever filed (bucketed: deliverables,
  client-assets, content). Upload directly or let gates file into it.
- **Reuse** any asset: one click turns it into a GROW content draft
  (prefilled, attributed to the original) — or attaches it to a workflow.

### GROW — the content engine

- `/grow`: ideas → **Generate** (agent writes, style-linted) → approve the
  card → **Schedule** → the publisher posts it through the connected channel.
- Nothing publishes without an approved card. A failed publish shows as
  FAILED with the provider error — retry is one click.
- `/memory` — company memory search: ask it anything ("what did LoopCo
  want?"), get ranked answers from every intake, deliverable, and decision the
  system has learned. Filter by client if you need.

### Evening

- Skim `/evolutions` — the learning loop proposes changes mined from your
  approve/reject history (preferences, playbook fixes, cost rules). **Apply**
  or **Deny** — a denied pattern is never re-proposed.
- `/pnl` shows AI cost per agent vs revenue. `/ledger` is the decision trail —
  every approval, replayable.

---

## KEY MANAGEMENT

All credentials live in the `provider_keys` table (DB-backed). No key is ever
in code, logs, or API responses (masked everywhere, e.g. `re_6…jkUL`).

| What | How | Where |
|---|---|---|
| **Resend (email sending)** | `POST /api/v1/providers/keys/resend {"key": "re_..."}` or Supabase dashboard → provider_keys | Status: `GET /api/v1/providers/email/status` |
| **SMTP (fallback sender)** | Same endpoint, key format: `host\|port\|user\|pass` (e.g. `smtp.gmail.com\|465\|you@gmail.com\|app-password`) | Tries after resend/sendgrid |
| **Publora (publishing)** | `/settings` → connect publisher, set active | `/grow` publish path |

**When a key dies:** the system never fakes a send/publish. Outreach queues
as `pending_send`, publishes show FAILED with the provider error. Swap the key
(same endpoint — it overwrites), then re-run: queued drafts send on the next
approve-and-send, failed publishes retry in place.

**Resend test-keys only deliver to your own address** until you verify a
domain at resend.com/domains — verify `spinachdigital.in` (or your sending
domain) to reach real leads.

---

## RECOVERY — when things break

**Supabase is down:** the API can't read or write anything. Nothing is lost —
the API serves honest 5xx errors, drafts/leads stay in the browser or queue
as pending. When Supabase returns, re-submit. Check status.supabase.com
first.

**The API is down:** restart it — `cd api && npx tsx src/index.ts` (dev) or
the PM2/service entry. Health check: `GET :4000/health`. The frontend keeps
working read-only from cache until it's back.

**A pipeline is stuck:** a stage won't advance until its gate is approved —
look for a pending gate card in THE INBOX first. If a gate was approved but
never ran (crash mid-run), re-run: `POST /api/v1/gates/:id/run` (idempotent —
it refuses to run twice).

**A publish failed:** open the item on `/grow` — the provider error is on the
card. Fix the cause (usually the provider key), click retry.

**An email didn't send:** check `/providers/email/status`. `connected: true`
but the draft says `pending_send` → the provider rejected it (error verbatim
in the draft's qualification note). Common: unverified-domain recipient
restriction, rate limit (20 sends/day hardcoded).

**Queues live in the database, not in memory:** pending approvals
(`approvals`), pending drafts (`outreach_drafts` status=pending_send),
scheduled content (`content_items` status=scheduled), gates
(`gate_actions` status=approved-not-run). A restart loses nothing.

---

## HONEST LIMITS — what this system does NOT do

- **No auto-publishing.** Every send, publish, and file needs your approve.
- **No cold outreach blasts.** 20 email sends/day, hard-coded. One email per
  lead, ever.
- **No multi-tenancy.** One founder (you), many clients. Client sessions see
  only their own portal — never the agency views (assets, memory, P&L are
  founder-only and probed to 401).
- **No mobile app.** The UI is responsive to 360px; capture-verified.
- **No automatic payments.** Invoices (`/portal`) mark paid — money moves
  outside the system.
- **SMTP is a fallback, not a promise.** If the SMTP key is stale, sends fail
  honestly with the provider error — they never fake success.
- **RAG search sees everything you do — and nothing clients shouldn't.**
  Founder sees all 100% of the index; client sessions get 401 (probed).

---

## The 10-minute shutdown checklist

1. `/today` — approvals pending = the number you're comfortable sleeping with.
2. Open tickets replied (or a card queued for tomorrow).
3. Tomorrow's content is scheduled (check GROW week card on /today).
4. No gate cards older than today (they only get staler).

*That's it. The system runs; you steer.*
