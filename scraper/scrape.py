"""
LeetCode Problem Scraper
Uses undetected-chromedriver to bypass Cloudflare, then hits the GraphQL API
from within the trusted browser session.

Usage:
    uv run python scrape.py                    # scrape all problems from CSVs
    uv run python scrape.py --slug two-sum     # scrape a single problem
    uv run python scrape.py --limit 10         # scrape first 10 only
    uv run python scrape.py --resume           # skip already-scraped problems
"""

import argparse
import csv
import glob
import json
import random
import time
from pathlib import Path

import html2text
import undetected_chromedriver as uc
from selenium.common.exceptions import (
    InvalidSessionIdException,
    WebDriverException,
)
from selenium.webdriver.support.ui import WebDriverWait

# Paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "companies"
OUTPUT_DIR = PROJECT_ROOT / "data" / "problems"

# GraphQL query to fetch all the data we need
GRAPHQL_QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) {
    questionId
    questionFrontendId
    title
    titleSlug
    difficulty
    content
    topicTags {
      name
      slug
    }
    stats
    similarQuestions
    hints
    categoryTitle
  }
}
"""


def get_unique_slugs() -> list[str]:
    """Extract unique problem slugs from all CSV files."""
    slugs = set()
    for f in glob.glob(str(DATA_DIR / "*.csv")):
        with open(f) as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                url = row.get("URL", "")
                if url:
                    parts = url.rstrip("/").split("/")
                    if len(parts) >= 5:
                        slugs.add(parts[-1])
    return sorted(slugs)


def setup_driver() -> uc.Chrome:
    """Create an undetected Chrome driver."""
    options = uc.ChromeOptions()
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")

    driver = uc.Chrome(options=options, version_main=145)
    return driver


def warm_up(driver: uc.Chrome, slug: str = "two-sum"):
    """Visit a LeetCode problem page directly to establish session and pass Cloudflare."""
    url = f"https://leetcode.com/problems/{slug}/"
    print(f"Warming up — visiting {url}")
    driver.get(url)
    time.sleep(8)

    try:
        WebDriverWait(driver, 30).until(
            lambda d: "leetcode" in d.title.lower() or "problem" in d.title.lower()
        )
        print(f"Cloudflare passed. Page title: {driver.title}")
    except Exception:
        print(f"Warning: may not have passed Cloudflare. Title: {driver.title}")
        print("Waiting a bit longer...")
        time.sleep(10)


def fetch_problem(driver: uc.Chrome, slug: str) -> dict | None:
    """Fetch problem data via GraphQL executed in the browser context."""
    script = """
    const query = arguments[0];
    const slug = arguments[1];
    const response = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            query: query,
            variables: { titleSlug: slug }
        })
    });
    const data = await response.json();
    return JSON.stringify(data);
    """
    try:
        result = driver.execute_script(script, GRAPHQL_QUERY, slug)
        data = json.loads(result)
        if data.get("data", {}).get("question"):
            return data["data"]["question"]
        print(f"  No question data returned for {slug}")
        return None
    except (InvalidSessionIdException, WebDriverException) as e:
        # Browser crashed or disconnected — signal caller to restart
        raise
    except Exception as e:
        print(f"  Error fetching {slug}: {e}")
        return None


def html_to_markdown(html_content: str) -> str:
    """Convert LeetCode HTML content to clean markdown."""
    h = html2text.HTML2Text()
    h.body_width = 0
    h.ignore_links = False
    h.ignore_images = False
    h.protect_links = True
    h.images_as_html = False
    h.unicode_snob = True
    return h.handle(html_content).strip()


def parse_problem(raw: dict) -> dict:
    """Parse raw GraphQL response into our desired format."""
    stats = json.loads(raw.get("stats", "{}"))

    similar_raw = json.loads(raw.get("similarQuestions", "[]"))
    similar_questions = []
    for sq in similar_raw:
        similar_questions.append(
            {
                "title": sq.get("title", ""),
                "slug": sq.get("titleSlug", ""),
                "difficulty": sq.get("difficulty", ""),
                "url": f"https://leetcode.com/problems/{sq.get('titleSlug', '')}/",
            }
        )

    content_html = raw.get("content", "") or ""
    content_md = html_to_markdown(content_html) if content_html else ""

    question_md, examples_md, constraints_md = split_content(content_md)

    topics = [tag["name"] for tag in raw.get("topicTags", [])]

    return {
        "id": raw.get("questionFrontendId", ""),
        "title": raw.get("title", ""),
        "slug": raw.get("titleSlug", ""),
        "difficulty": raw.get("difficulty", ""),
        "category": raw.get("categoryTitle", ""),
        "content_html": content_html,
        "content_markdown": content_md,
        "question": question_md,
        "examples": examples_md,
        "constraints": constraints_md,
        "topics": topics,
        "total_accepted": stats.get("totalAcceptedRaw", 0),
        "total_submissions": stats.get("totalSubmissionRaw", 0),
        "acceptance_rate": stats.get("acRate", ""),
        "similar_questions": similar_questions,
        "hints": raw.get("hints", []),
    }


def split_content(md: str) -> tuple[str, str, str]:
    """Split markdown content into question, examples, constraints sections."""
    lines = md.split("\n")
    question_lines = []
    examples_lines = []
    constraints_lines = []

    section = "question"

    for line in lines:
        stripped = line.strip().lower()

        if stripped.startswith("**example") or stripped.startswith("example "):
            section = "examples"
        elif stripped.startswith("**constraints") or stripped.startswith("constraints"):
            section = "constraints"
        elif stripped.startswith("**follow up") or stripped.startswith("**follow-up"):
            section = "followup"

        if section == "question":
            question_lines.append(line)
        elif section == "examples":
            examples_lines.append(line)
        elif section == "constraints":
            constraints_lines.append(line)

    return (
        "\n".join(question_lines).strip(),
        "\n".join(examples_lines).strip(),
        "\n".join(constraints_lines).strip(),
    )


def scrape_slugs(slugs: list[str], delay_min: float, delay_max: float) -> list[str]:
    """Scrape a list of slugs. Returns list of failed slugs.
    Auto-restarts the browser on crash."""
    driver = None
    failed = []
    success = 0
    i = 0

    while i < len(slugs):
        slug = slugs[i]

        # Start driver if needed
        if driver is None:
            print(f"\n--- Starting browser (at problem {i + 1}/{len(slugs)}) ---")
            try:
                driver = setup_driver()
                warm_up(driver, slug)
            except Exception as e:
                print(f"Failed to start browser: {e}")
                print("Retrying in 15 seconds...")
                time.sleep(15)
                continue

        print(f"[{i + 1}/{len(slugs)}] Scraping: {slug}")

        try:
            raw = fetch_problem(driver, slug)
            if raw:
                parsed = parse_problem(raw)
                out_path = OUTPUT_DIR / f"{slug}.json"
                with open(out_path, "w") as f:
                    json.dump(parsed, f, indent=2, ensure_ascii=False)
                success += 1
                print(f"  Saved: {out_path.name}")
            else:
                failed.append(slug)
                print(f"  FAILED: {slug}")

            i += 1  # Move to next problem

            # Rate limiting with jitter
            if i < len(slugs):
                delay = random.uniform(delay_min, delay_max)
                time.sleep(delay)

        except (InvalidSessionIdException, WebDriverException) as e:
            # Browser crashed — restart it and retry this same slug
            print(f"  Browser crashed: {type(e).__name__}")
            print("  Restarting browser...")
            try:
                driver.quit()
            except Exception:
                pass
            driver = None
            time.sleep(5)
            # Don't increment i — retry this slug

    # Cleanup
    if driver:
        try:
            driver.quit()
        except Exception:
            pass

    print(f"\nBatch done! {success}/{len(slugs)} scraped successfully.")
    return failed


def find_empty_results() -> list[str]:
    """Find scraped problems that have empty critical fields."""
    empty_slugs = []
    for f in OUTPUT_DIR.glob("*.json"):
        if f.name.startswith("_"):
            continue
        with open(f) as fh:
            data = json.load(fh)

        # Check if any critical field is empty
        if (
            not data.get("content_html")
            or not data.get("content_markdown")
            or not data.get("question")
            or not data.get("examples")
            or not data.get("constraints")
            or not data.get("topics")
            or not data.get("acceptance_rate")
        ):
            empty_slugs.append(f.stem)

    return sorted(empty_slugs)


def main():
    parser = argparse.ArgumentParser(description="Scrape LeetCode problem data")
    parser.add_argument("--slug", help="Scrape a single problem by slug")
    parser.add_argument("--limit", type=int, help="Max number of problems to scrape")
    parser.add_argument(
        "--resume", action="store_true", help="Skip already-scraped problems"
    )
    parser.add_argument(
        "--retry-failed", action="store_true", help="Retry only failed problems"
    )
    parser.add_argument(
        "--fix-empty",
        action="store_true",
        help="Re-scrape problems with empty fields",
    )
    parser.add_argument(
        "--delay-min", type=float, default=1.5, help="Min delay between requests (s)"
    )
    parser.add_argument(
        "--delay-max", type=float, default=3.5, help="Max delay between requests (s)"
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=3,
        help="Max retry attempts for failed/empty",
    )
    args = parser.parse_args()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Determine slugs to scrape
    if args.retry_failed:
        failed_path = OUTPUT_DIR / "_failed.json"
        if failed_path.exists():
            with open(failed_path) as f:
                slugs = json.load(f)
            print(f"Retrying {len(slugs)} failed problems")
        else:
            print("No _failed.json found")
            return
    elif args.fix_empty:
        slugs = find_empty_results()
        if slugs:
            # Delete the empty files so they get re-scraped
            for slug in slugs:
                (OUTPUT_DIR / f"{slug}.json").unlink(missing_ok=True)
            print(f"Found {len(slugs)} problems with empty fields to re-scrape")
        else:
            print("No empty results found!")
            return
    elif args.slug:
        slugs = [args.slug]
    else:
        slugs = get_unique_slugs()
        print(f"Found {len(slugs)} unique problems to scrape")

    # Filter already scraped if resuming
    if args.resume:
        existing = {f.stem for f in OUTPUT_DIR.glob("*.json") if not f.name.startswith("_")}
        before = len(slugs)
        slugs = [s for s in slugs if s not in existing]
        print(f"Resuming: {before - len(slugs)} already scraped, {len(slugs)} remaining")

    if args.limit:
        slugs = slugs[: args.limit]
        print(f"Limiting to {len(slugs)} problems")

    if not slugs:
        print("Nothing to scrape!")
        return

    # Scrape with retries
    failed = scrape_slugs(slugs, args.delay_min, args.delay_max)

    # Retry failed problems up to max_retries times
    retry_count = 0
    while failed and retry_count < args.max_retries:
        retry_count += 1
        print(f"\n=== RETRY {retry_count}/{args.max_retries}: {len(failed)} problems ===")
        time.sleep(10)  # Cool down before retry
        failed = scrape_slugs(failed, args.delay_min, args.delay_max)

    # Save any remaining failures
    if failed:
        with open(OUTPUT_DIR / "_failed.json", "w") as f:
            json.dump(failed, f, indent=2)
        print(f"\n{len(failed)} problems still failed after {args.max_retries} retries.")
        print(f"Saved to {OUTPUT_DIR / '_failed.json'}")
    else:
        # Clear failed file if all succeeded
        (OUTPUT_DIR / "_failed.json").unlink(missing_ok=True)
        print("\nAll problems scraped successfully!")

    # Final stats
    total_scraped = len(list(OUTPUT_DIR.glob("*.json"))) - (
        1 if (OUTPUT_DIR / "_failed.json").exists() else 0
    )
    print(f"\nTotal files in output: {total_scraped}")


if __name__ == "__main__":
    main()
