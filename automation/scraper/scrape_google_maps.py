#!/usr/bin/env python
"""Google Maps Local Business Scraper — discovers local businesses (gyms, clinics, salons, etc.) for lead gen.
Runs via Hermes cron (daily 8am). Ingests leads to Spinach OS API.

Uses Playwright for browser automation (no Google Places API billing required).

Usage:
    python scrape_google_maps.py --queries "gyms,dental clinics,salons" --location "Mumbai" --limit 50
    python scrape_google_maps.py --queries "gyms" --location "Bangalore" --dry-run

Requirements:
    pip install playwright
    playwright install chromium
"""
import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("ERROR: Playwright not installed. Run: pip install playwright && playwright install chromium")
    sys.exit(1)

API_BASE = "http://localhost:4000/api/v1"

def _token():
    """Director JWT from scraper_token.txt"""
    try:
        with open(Path(__file__).parent / "scraper_token.txt") as f:
            return f.read().strip()
    except OSError:
        return ""

TOKEN = _token()

HEADLESS = True

def build_search_url(query: str, location: str) -> str:
    """Build Google Maps search URL."""
    from urllib.parse import quote_plus
    return f"https://www.google.com/maps/search/{quote_plus(query + ' ' + location)}"

def scroll_results(page, max_results: int = 50) -> None:
    """Scroll the results panel to load more listings."""
    # Try multiple selectors for the scrollable feed
    selectors = [
        'div[role="feed"]',
        'div.m6QErb.DxyBCb.kA9KIf.dS8AEf.XiKgde',
        'div[aria-label*="Results"]',
        'div.section-scrollbox',
    ]
    
    feed = None
    for sel in selectors:
        feed = page.locator(sel).first
        if feed.count():
            break
    
    if not feed or not feed.count():
        print("  [WARN] Could not find scrollable feed")
        return

    last_count = 0
    for _ in range(20):  # max scroll iterations
        try:
            page.evaluate("(element) => element.scrollTop = element.scrollHeight", feed)
        except Exception:
            # Try mouse wheel instead
            feed.hover()
            page.mouse.wheel(0, 1000)
        page.wait_for_timeout(800)
        cards = page.locator('a.hfpxzc, div[role="article"], div.Nv2PK').all()
        count = len(cards)
        if count >= max_results or count == last_count:
            break
        last_count = count

def extract_place_data(page, card) -> dict | None:
    """Extract lead data from a place card."""
    try:
        # Click to open details panel
        card.click()
        page.wait_for_timeout(1000)

        # Extract from the details panel (right side)
        # Name
        name_el = page.locator('h1.DUwDvf, h1.x3AX1-LfntMc-header-title-title').first
        name = name_el.inner_text().strip() if name_el.count() else None

        if not name:
            return None

        # Address
        address_el = page.locator('button[data-item-id="address"] .Io6YTe').first
        address = address_el.inner_text().strip() if address_el.count() else None

        # Phone
        phone_el = page.locator('button[data-item-id^="phone:"] .Io6YTe').first
        phone = phone_el.inner_text().strip() if phone_el.count() else None

        # Website
        website_el = page.locator('a[data-item-id="authority"]').first
        website = website_el.get_attribute("href") if website_el.count() else None

        # Rating
        rating_el = page.locator('div.F7nice span[aria-hidden="true"]').first
        rating = rating_el.inner_text().strip() if rating_el.count() else None

        # Reviews count
        reviews_el = page.locator('div.F7nice span[aria-label*="reviews"]').first
        reviews_text = reviews_el.inner_text().strip() if reviews_el.count() else None
        reviews = None
        if reviews_text:
            m = re.search(r'([\d,]+)', reviews_text)
            if m:
                reviews = int(m.group(1).replace(',', ''))

        # Category
        category_el = page.locator('button[jsaction*="category"] .Io6YTe').first
        category = category_el.inner_text().strip() if category_el.count() else None

        # Plus code / coordinates from URL
        url = page.url
        coords = None
        m = re.search(r'@(-?\d+\.\d+),(-?\d+\.\d+)', url)
        if m:
            coords = {"lat": float(m.group(1)), "lng": float(m.group(2))}

        # Build lead
        lead = {
            "company": name,
            "source": "google_maps",
            "name": None,  # contact person unknown
            "role": None,
            "email": None,
            "phone": phone,
            "score": score_lead(name, category, rating, reviews),
            "metadata": {
                "address": address,
                "website": website,
                "rating": float(rating) if rating else None,
                "reviews": reviews,
                "category": category,
                "coordinates": coords,
                "maps_url": url,
            },
        }
        return lead
    except Exception as e:
        print(f"  [WARN] Failed to extract place: {e}")
        return None

def score_lead(name: str, category: str, rating: str, reviews: int) -> int:
    """Score 0-100 based on business signals."""
    score = 40  # base for having a Maps listing
    if not name:
        return 0
    # Rating boost
    try:
        if rating:
            r = float(rating)
            if r >= 4.5:
                score += 15
            elif r >= 4.0:
                score += 10
            elif r >= 3.5:
                score += 5
    except ValueError:
        pass
    # Reviews boost
    if reviews:
        if reviews >= 500:
            score += 15
        elif reviews >= 100:
            score += 10
        elif reviews >= 20:
            score += 5
    # Category relevance for our targets
    cat = (category or "").lower()
    if any(k in cat for k in ["gym", "fitness", "yoga", "crossfit"]):
        score += 10
    elif any(k in cat for k in ["dental", "clinic", "dentist", "orthodontist"]):
        score += 10
    elif any(k in cat for k in ["salon", "spa", "beauty", "hair", "nail"]):
        score += 10
    elif any(k in cat for k in ["restaurant", "cafe", "coffee"]):
        score += 5
    return min(score, 100)

def ingest(leads: list[dict], dry_run: bool = False) -> dict:
    if dry_run:
        return {"dry_run": True, "would_insert": len(leads)}
    req = urllib.request.Request(
        f"{API_BASE}/scraper/ingest",
        data=json.dumps({"source": "google_maps", "leads": leads}).encode(),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {TOKEN}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def scrape_location(query: str, location: str, limit: int) -> list[dict]:
    """Scrape a single query+location combo."""
    print(f"[{datetime.now(timezone.utc).isoformat()}] Scraping '{query}' in '{location}' (limit={limit})")
    url = build_search_url(query, location)
    leads = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=HEADLESS)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            locale="en-US",
        )
        page = context.new_page()
        try:
            print(f"  Loading {url}")
            page.goto(url, wait_until="domcontentloaded", timeout=90000)  # increased timeout, wait for DOM
            page.wait_for_timeout(5000)  # wait for dynamic content

            # Handle cookie consent if present
            try:
                page.locator('button:has-text("Accept all"), button:has-text("I agree"), button:has-text("Accept")').first.click(timeout=3000)
                page.wait_for_timeout(500)
            except Exception:
                pass

            # Scroll to load results
            scroll_results(page, max_results=limit)

            # Get all place cards
            cards = page.locator('a.hfpxzc, div[role="article"]').all()
            print(f"  Found {len(cards)} place cards")

            for i, card in enumerate(cards[:limit]):
                try:
                    lead = extract_place_data(page, card)
                    if lead:
                        leads.append(lead)
                        print(f"  [{i+1}/{len(cards)}] {lead['company']} ({lead['metadata'].get('category','')}) - score {lead['score']}")
                    else:
                        print(f"  [{i+1}/{len(cards)}] Skipped (no data)")
                except Exception as e:
                    print(f"  [WARN] Card {i+1} failed: {e}")

        except Exception as e:
            print(f"  [ERROR] Page load failed: {e}")
        finally:
            browser.close()

    return leads

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--queries", default="gyms,dental clinics,salons", help="Comma-separated business types")
    ap.add_argument("--location", default="Mumbai", help="City/area to search")
    ap.add_argument("--limit", type=int, default=50, help="Max results per query")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--headless", action="store_true")
    args = ap.parse_args()

    global HEADLESS
    if args.headless:
        HEADLESS = True

    queries = [q.strip() for q in args.queries.split(",")]
    all_leads = []

    for query in queries:
        leads = scrape_location(query, args.location, args.limit)
        all_leads.extend(leads)
        print(f"  -> {len(leads)} leads from '{query}' in '{args.location}'")

    # Deduplicate by name+address
    seen = set()
    unique = []
    for lead in all_leads:
        key = (lead["company"], lead["metadata"].get("address"))
        if key not in seen:
            seen.add(key)
            unique.append(lead)

    print(f"\nTotal unique leads: {len(unique)}")
    result = ingest(unique, args.dry_run)
    print(f"Ingest result: {json.dumps(result)}")

if __name__ == "__main__":
    main()