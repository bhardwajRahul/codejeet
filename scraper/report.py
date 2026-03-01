"""Generate a quality report of all scraped data."""

import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "problems"

# Categories where missing constraints/topics are expected
NO_CONSTRAINTS_CATEGORIES = {"Database", "Shell", "Concurrency", "JavaScript", "pandas"}
NO_TOPICS_CATEGORIES = {"JavaScript", "pandas"}


def main():
    files = sorted(OUTPUT_DIR.glob("*.json"))
    files = [f for f in files if not f.name.startswith("_")]

    total = len(files)
    premium = []
    non_premium = []
    empty_constraints_real = []
    empty_topics_real = []
    empty_acceptance = []
    has_images = 0

    for f in files:
        with open(f) as fh:
            d = json.load(fh)

        slug = f.stem
        category = d.get("category", "")

        if not d.get("content_html"):
            premium.append(slug)
            continue

        non_premium.append(slug)

        if not d.get("constraints") and category not in NO_CONSTRAINTS_CATEGORIES:
            empty_constraints_real.append(slug)
        if not d.get("topics") and category not in NO_TOPICS_CATEGORIES:
            empty_topics_real.append(slug)
        if not d.get("acceptance_rate"):
            empty_acceptance.append(slug)
        if "img" in d.get("content_html", ""):
            has_images += 1

    # Check for failed file
    failed_path = OUTPUT_DIR / "_failed.json"
    failed_count = 0
    if failed_path.exists():
        with open(failed_path) as f:
            failed = json.load(f)
            failed_count = len(failed)

    print("=" * 60)
    print("LEETCODE SCRAPER — QUALITY REPORT")
    print("=" * 60)
    print(f"Total scraped files:      {total}")
    print(f"  Premium (no content):   {len(premium)}")
    print(f"  Non-premium:            {len(non_premium)}")
    print(f"Failed (not scraped):     {failed_count}")
    print(f"Problems with images:     {has_images}")
    print()
    print("--- Non-premium data issues ---")
    print(f"Missing constraints:      {len(empty_constraints_real)} (excl. DB/Shell/Concurrency)")
    print(f"Missing topics:           {len(empty_topics_real)} (excl. JS/Pandas)")
    print(f"Missing acceptance_rate:  {len(empty_acceptance)}")
    print()

    if empty_constraints_real:
        print(f"--- {len(empty_constraints_real)} problems missing constraints ---")
        for slug in sorted(empty_constraints_real):
            print(f"  {slug}")
    if empty_topics_real:
        print(f"\n--- {len(empty_topics_real)} problems missing topics ---")
        for slug in sorted(empty_topics_real):
            print(f"  {slug}")

    issues = set(empty_constraints_real + empty_topics_real + empty_acceptance)
    completeness = (len(non_premium) - len(issues)) / len(non_premium) * 100 if non_premium else 0
    print()
    print(f"Non-premium completeness: {completeness:.1f}% ({len(non_premium) - len(issues)}/{len(non_premium)})")
    print("=" * 60)

    # Save report
    report = {
        "total_scraped": total,
        "premium_count": len(premium),
        "non_premium_count": len(non_premium),
        "failed_count": failed_count,
        "has_images": has_images,
        "empty_constraints_real": empty_constraints_real,
        "empty_topics_real": empty_topics_real,
        "empty_acceptance": empty_acceptance,
        "completeness_pct": round(completeness, 1),
    }
    with open(OUTPUT_DIR / "_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nFull report saved to {OUTPUT_DIR / '_report.json'}")


if __name__ == "__main__":
    main()
