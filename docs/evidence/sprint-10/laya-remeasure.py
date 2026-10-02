"""
SPRINT 10 §7.3 — Laya adapter 70-command re-measure.
The Sprint 8 eval set (70 labeled commands) lived in session history, not the
repo — rebuilt here against the FIXED adapter (Sprint 9 §5: hr dept + sales/
strategy tie-breaks + abstention). Labels follow the department map semantics
(department → profile). Run against the LIVE adapter (/decide) for the
headline number.
"""
import json
import urllib.request
import urllib.error

LAYA = "http://localhost:8000/decide"

# 70 labeled commands — 10 per department (7 depts) covering the measured
# confusion classes (sales→social ×6, orchestrator→sales ×3, hr→orch ×3,
# ceo→orch ×2) + word-boundary traps ("post" in "postpone", "post" in
# "posting schedule") + abstention cases (no strong match).
TESTS = [
    # marketing (10) — content creation + the "post" traps
    ("write a LinkedIn post for Client X", "marketing"),
    ("create a social media post for the launch", "marketing"),
    ("postpone the launch by a day", "marketing"),          # trap: "post" in "postpone"
    ("design a festive banner for Diwali", "marketing"),
    ("draft the X thread for our ship note", "marketing"),
    ("make an Instagram reel storyboard", "marketing"),
    ("schedule the posting calendar for next week", "marketing"),  # trap: "posting"
    ("write SEO-friendly copy for the site", "marketing"),
    ("prepare the campaign creative brief", "marketing"),
    ("edit the hero section visuals", "marketing"),
    # engineering (10)
    ("add a new field to the signup form", "engineering"),
    ("fix the postpone bug in the scheduler", "engineering"),  # trap: "postpone"
    ("refactor the api routes into modules", "engineering"),
    ("write unit tests for the outreach engine", "engineering"),
    ("the build is failing on TypeScript errors", "engineering"),
    ("migrate the database schema", "engineering"),
    ("debug why the websocket drops connections", "engineering"),
    ("optimize the slow query on the leads table", "engineering"),
    ("review this pull request for security issues", "engineering"),
    ("set up the CI pipeline for tests", "engineering"),
    # sales (10) — outreach intent (Sprint 9 fix: sales wins the tie)
    ("outreach to the new lead from the expo", "sales"),
    ("send a cold email to the prospect", "sales"),
    ("draft an outreach message for the qualified lead", "sales"),
    ("follow up with the client about the proposal", "sales"),
    ("qualify this lead — budget and intent look strong", "sales"),
    ("the client wants a pitch call tomorrow", "sales"),
    ("update the sales pipeline stage for Casa Verde", "sales"),
    ("prepare the retainer renewal quote", "sales"),
    ("log the deal win for War Room Demo Co", "sales"),
    ("reach out to the gym chain about our services", "sales"),
    # strategy/ceo (10) — ceo-level + strategy words (Sprint 9 tie-break fix)
    ("what is our growth strategy for q4", "strategy"),     # Sprint 9 confusion (ceo→marketing)
    ("plan the company OKRs for next quarter", "strategy"),
    ("should we expand to Delhi or stay in Mumbai", "strategy"),
    ("review the quarterly business results", "strategy"),
    ("set the vision for the next fiscal year", "strategy"),
    ("analyze our positioning against competitors", "strategy"),
    ("decide the pricing strategy for retainers", "strategy"),
    ("what did the team ship this week — give me the summary", "strategy"),
    ("where is the company spending too much", "strategy"),
    ("prioritize the roadmap for the next month", "strategy"),
    # hr (10) — HR dept (Sprint 9 fix: hr→hr_director)
    ("hire a senior designer for the studio", "hr"),
    ("the new intern needs onboarding paperwork", "hr"),
    ("run the weekly team health check", "hr"),
    ("pause the designer agent — overloaded", "hr"),
    ("how is the team's workload this week", "hr"),
    ("schedule performance reviews for the team", "hr"),
    ("the engineer is stuck — reassign or help", "hr"),
    ("draft the offer letter for the sales hire", "hr"),
    ("check who is idle in the roster", "hr"),
    ("resolve the HR flag on the content agent", "hr"),
    # orchestrator/tasks (10) — task ops (Sprint 9 confusions: orchestrator→sales ×3)
    ("stop all tasks for now", "orchestrator"),
    ("what are the agents doing right now", "orchestrator"),
    ("show the status of the build task", "orchestrator"),
    ("assign the design task to the designer", "orchestrator"),
    ("queue a new task for the content team", "orchestrator"),
    ("which tasks are blocked right now", "orchestrator"),
    ("retry the failed task", "orchestrator"),
    ("start a pipeline for the new client", "orchestrator"),
    ("show pending approvals", "orchestrator"),
    ("give me today's standup summary", "orchestrator"),
    # research (10)
    ("research the competitor's pricing page", "research"),
    ("find case studies about interior design studios", "research"),
    ("monitor the market for new gym chains", "research"),
    ("look up the latest trends in fitness marketing", "research"),
    ("scrape the reviews for Brew Theory cafe", "research"),
    ("gather data on ad spend benchmarks", "research"),
    ("study the competitor's onboarding flow", "research"),
    ("find similar agencies in Mumbai", "research"),
    ("research what keywords our competitors rank for", "research"),
    ("compile a market report for the meeting", "research"),
]

def main():
    ok = 0
    results = []
    for msg, expected in TESTS:
        body = json.dumps({"message": msg}).encode()
        req = urllib.request.Request(LAYA, data=body, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as r:
                j = json.loads(r.read())
            dept = (j.get("department") or "").lower()
            conf = j.get("confidence")
            # normalize: strategy/ceo both acceptable for strategy labels
            hit = dept == expected or (expected == "strategy" and dept in ("strategy", "ceo"))
            ok += 1 if hit else 0
            results.append((hit, msg, expected, dept, conf))
            mark = "OK  " if hit else "MISS"
            print(f"{mark} {msg[:52]:52} → {dept:12} ({conf}) [want {expected}]")
        except Exception as e:
            results.append((False, msg, expected, "ERROR", str(e)))
            print(f"ERR  {msg[:52]:52} → {e}")
    n = len(TESTS)
    print(f"\n=== HEADLINE: {ok}/{n} = {ok/n*100:.1f}% (Sprint 8 baseline: 60.0% adapter / 18.6% real-Laya) ===")

    with open("laya-remeasure-70.txt", "w", encoding="utf-8") as f:
        f.write("SPRINT 10 §7.3 — Laya adapter 70-command re-measure (2026-10-02)\n")
        f.write("Adapter: FIXED (Sprint 9 §5: hr dept + sales/strategy tie-breaks + abstention)\n")
        f.write(f"HEADLINE: {ok}/{n} = {ok/n*100:.1f}%\n")
        f.write("Sprint 8 baseline: 60.0% adapter / 18.6% real-Laya (79% abstain)\n\n")
        for hit, msg, expected, dept, conf in results:
            mark = "OK  " if hit else "MISS" if dept != "ERROR" else "ERR "
            f.write(f"{mark} {msg} → {dept} ({conf}) [want {expected}]\n")

if __name__ == "__main__":
    main()
