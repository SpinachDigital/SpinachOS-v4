#!/usr/bin/env python
"""GitHub Trending scraper — discovers tech companies hiring / active repos.
Runs via Hermes cron (daily 6am). Ingests leads to Spinach OS API.

Usage:
    python scrape_github.py [--dry-run] [--limit 25]

Flow:
    1. Fetch GitHub trending page (no auth needed for public page)
    2. Parse repo name, owner, description, language, stars
    3. Score lead (activity signals: fresh pushes, star velocity, hiring keywords)
    4. POST /api/v1/scraper/ingest with leads
"""
import argparse
import json
import re
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

API_BASE = "http://localhost:4000/api/v1"
# Service key read from api/.env (never hardcoded)
def _token():
    """Director JWT signed with api/.env JWT_SECRET — written by setup, never hardcoded."""
    try:
        with open(r"C:\Users\Abhishek\SpinachOS-v4\automation\scraper\scraper_token.txt") as f:
            return f.read().strip()
    except OSError:
        pass
    return ""

TOKEN = _token()

HIRING_KEYWORDS = ["hiring", "we're hiring", "join us", "careers", "jobs", "recruiting"]

def fetch_trending(language: str = "", since: str = "daily") -> list[dict]:
    """Fetch and parse GitHub trending page."""
    url = f"https://github.com/trending/{language}?since={since}"
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    repos = []
    # Each repo is an <article> — GitHub's markup varies; try multiple href patterns
    articles = re.findall(r'<article class="Box-row">(.*?)</article>', html, re.DOTALL)
    for art in articles:
        path = None
        # Primary: h2 > a[href] (repo link)
        m = re.search(r'<h2[^>]*>.*?<a[^>]*href="/([^"]+)"', art, re.DOTALL)
        if m:
            path = m.group(1).strip("/")
        if not path:
            # Fallback: first href that looks like owner/repo (skip sponsors/apps/stargazers etc.)
            hrefs = re.findall(r'href="(/[^"#]+)"', art)
            for h in hrefs:
                p = h.strip("/")
                if (
                    "/" in p
                    and p.count("/") == 1
                    and not p.startswith(("sponsors/", "apps/", "features/", "collections/", "topics/", "trending"))
                ):
                    path = p
                    break
        if not path or "/" not in path:
            continue
        owner, name = path.split("/", 1)

        desc_m = re.search(r'<p class="col-9[^"]*">\s*(.*?)\s*</p>', art, re.DOTALL)
        desc = re.sub(r"<[^>]+>", "", desc_m.group(1)).strip() if desc_m else ""

        lang_m = re.search(r'itemprop="programmingLanguage">([^<]+)<', art)
        lang = lang_m.group(1).strip() if lang_m else None

        stars_m = re.search(r'href="/[^"]+/stargazers".*?aria-label="[^"]*"\s*class="[^"]*">\s*([\d,\.km]+)\s*</a>', art, re.DOTALL)
        stars_today_m = re.search(r'([\d,]+)\s*stars today', art)
        stars_today_m2 = re.search(r'([\d,]+)\s*stars this week', art)

        stars = stars_m.group(1) if stars_m else None
        stars_today = stars_today_m.group(1) if stars_today_m else (stars_today_m2.group(1) if stars_today_m2 else "0")

        repos.append({
            "owner": owner,
            "name": name,
            "path": path,
            "description": desc,
            "language": lang,
            "stars": stars,
            "stars_today": stars_today,
        })
    return repos

def score_lead(repo: dict) -> int:
    """Score 0-100: activity + hiring signals."""
    score = 30  # base
    # Star velocity
    try:
        st = int(repo.get("stars_today", "0").replace(",", ""))
        score += min(st * 2, 30)
    except ValueError:
        pass
    # Hiring keywords in description
    desc = (repo.get("description") or "").lower()
    if any(k in desc for k in HIRING_KEYWORDS):
        score += 25
    # Language bonus (Python/TS ecosystem)
    if repo.get("language") in ("Python", "TypeScript", "JavaScript"):
        score += 10
    return min(score, 100)

def ingest(leads: list[dict], dry_run: bool = False) -> dict:
    if dry_run:
        return {"dry_run": True, "would_insert": len(leads)}
    req = urllib.request.Request(
        f"{API_BASE}/scraper/ingest",
        data=json.dumps({"source": "github", "leads": leads}).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {TOKEN}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=25)
    ap.add_argument("--language", default="")
    ap.add_argument("--since", default="daily", choices=["daily", "weekly", "monthly"])
    args = ap.parse_args()

    print(f"[{datetime.now(timezone.utc).isoformat()}] GitHub trending scrape starting (since={args.since})")
    try:
        repos = fetch_trending(args.language, args.since)
    except Exception as e:
        print(f"ERROR fetching trending: {e}")
        sys.exit(1)

    print(f"Fetched {len(repos)} repos")
    leads = []
    for repo in repos[: args.limit]:
        leads.append({
            "name": repo["name"],
            "company": repo["owner"],
            "source": "github",
            "role": None,
            "email": None,
            "score": score_lead(repo),
            "metadata": {
                "repo_path": repo["path"],
                "description": repo["description"][:300],
                "language": repo["language"],
                "stars": repo["stars"],
                "stars_today": repo["stars_today"],
            },
        })

    result = ingest(leads, args.dry_run)
    print(f"Ingest result: {json.dumps(result)}")

if __name__ == "__main__":
    main()
