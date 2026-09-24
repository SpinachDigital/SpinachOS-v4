#!/usr/bin/env python
"""Hacker News "Who's Hiring" scraper — discovers companies hiring.
Runs via Hermes cron (daily 7am). Ingests leads to Spinach OS API.

Usage:
    python scrape_hackernews.py [--dry-run] [--limit 40] [--thread-id <id>]

Flow:
    1. Fetch latest "Ask HN: Who is hiring?" thread via Algolia HN API (no auth)
    2. Parse top-level comments (each = one company hiring)
    3. Extract company, role, location, remote/onsite, email
    4. Score lead and POST /api/v1/scraper/ingest
"""
import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone

API_BASE = "http://localhost:4000/api/v1"
ALGOLIA = "https://hn.algolia.com/api/v1"

def _token():
    """Director JWT signed with api/.env JWT_SECRET — written by setup, never hardcoded."""
    try:
        with open(r"C:\Users\Abhishek\SpinachOS-v4\automation\scraper\scraper_token.txt") as f:
            return f.read().strip()
    except OSError:
        pass
    return ""

TOKEN = _token()

def find_latest_hiring_thread() -> str | None:
    """Find the most recent 'Ask HN: Who is hiring?' story ID."""
    url = f"{ALGOLIA}/search_by_date?query=%22Ask%20HN%3A%20Who%20is%20hiring%3F%22&tags=story&hitsPerPage=1"
    req = urllib.request.Request(url, headers={"User-Agent": "SpinachOS-Scraper/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    hits = data.get("hits", [])
    if not hits:
        return None
    return hits[0].get("objectID"), hits[0].get("created_at")

def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text or "").strip()

def fetch_comments(thread_id: str, limit: int) -> list[dict]:
    """Fetch top-level comments of the hiring thread."""
    url = f"{ALGOLIA}/items/{thread_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "SpinachOS-Scraper/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = json.loads(resp.read().decode())
    children = data.get("children", [])
    comments = []
    for c in children[:limit]:
        text = strip_html(c.get("text") or "")
        if not text:
            continue
        comments.append({
            "comment_id": c.get("id"),
            "author": c.get("author"),
            "created_at": c.get("created_at"),
            "text": text,
        })
    return comments

def parse_comment(comment: dict) -> dict | None:
    """Extract structured lead from a hiring comment."""
    text = comment["text"]
    first_line = text.split("\n")[0][:200]

    # Company: often first token or after "Company:"
    company = None
    m = re.search(r"Company:\s*([^\n|]+)", text, re.IGNORECASE)
    if m:
        company = m.group(1).strip()[:100]
    else:
        # First segment before | or — often company
        seg = re.split(r"\s*[|—–-]\s*", first_line)[0].strip()
        if seg and len(seg) < 60:
            company = seg

    # Role
    role = None
    m = re.search(r"(?:Role|Position|Title|Looking for)[:\s]+([^\n|]+)", text, re.IGNORECASE)
    if m:
        role = m.group(1).strip()[:100]

    # Location / remote
    location = None
    remote = None
    m = re.search(r"Location:\s*([^\n|]+)", text, re.IGNORECASE)
    if m:
        location = m.group(1).strip()[:100]
    tl = first_line.lower() + " " + text[:500].lower()
    if "remote" in tl:
        remote = "remote" in tl and ("onsite" not in tl or tl.index("remote") < tl.index("onsite"))
        if remote:
            location = location or "Remote"

    # Email
    email = None
    m = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
    if m:
        email = m.group(0)

    if not company:
        return None

    return {
        "company": company,
        "role": role,
        "location": location,
        "remote": remote,
        "email": email,
        "comment_id": comment["comment_id"],
        "author": comment["author"],
        "created_at": comment["created_at"],
        "text_preview": text[:400],
    }

def score_lead(lead: dict) -> int:
    score = 40  # hiring threads are high-intent
    if lead.get("remote"):
        score += 10
    if lead.get("email"):
        score += 15
    tl = (lead.get("text_preview") or "").lower()
    if any(k in tl for k in ["python", "typescript", "javascript", "react", "node"]):
        score += 15
    if any(k in tl for k in ["india", "bangalore", "mumbai", "remote india"]):
        score += 10
    return min(score, 100)

def ingest(leads: list[dict], dry_run: bool = False) -> dict:
    if dry_run:
        return {"dry_run": True, "would_insert": len(leads)}
    req = urllib.request.Request(
        f"{API_BASE}/scraper/ingest",
        data=json.dumps({"source": "hackernews", "leads": leads}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=40)
    ap.add_argument("--thread-id", default=None, help="Specific story ID (default: latest)")
    args = ap.parse_args()

    print(f"[{datetime.now(timezone.utc).isoformat()}] HN hiring scrape starting")
    try:
        if args.thread_id:
            thread_id = args.thread_id
        else:
            found = find_latest_hiring_thread()
            if not found:
                print("ERROR: no hiring thread found")
                sys.exit(1)
            thread_id, thread_date = found
            print(f"Latest thread: {thread_id} (created {thread_date})")
    except Exception as e:
        print(f"ERROR finding thread: {e}")
        sys.exit(1)

    try:
        comments = fetch_comments(thread_id, args.limit)
    except Exception as e:
        print(f"ERROR fetching comments: {e}")
        sys.exit(1)

    print(f"Fetched {len(comments)} comments")
    leads = []
    for c in comments:
        parsed = parse_comment(c)
        if not parsed:
            continue
        leads.append({
            "name": parsed["author"],
            "company": parsed["company"],
            "role": parsed["role"],
            "email": parsed["email"],
            "source": "hackernews",
            "score": score_lead(parsed),
            "metadata": {
                "hn_comment_id": parsed["comment_id"],
                "hn_thread_id": thread_id,
                "location": parsed["location"],
                "remote": parsed["remote"],
                "text_preview": parsed["text_preview"],
            },
        })

    print(f"Parsed {len(leads)} leads")
    result = ingest(leads, args.dry_run)
    print(f"Ingest result: {json.dumps(result)}")

if __name__ == "__main__":
    main()
