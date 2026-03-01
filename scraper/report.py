"""Generate a quality report of all scraped data."""

import json
from pathlib import Path

OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def main():
    files = sorted(OUTPUT_DIR.glob("*.json"))
    files = [f for f in files if not f.name.startswith("_")]

    total = len(files)
    empty_content = []
    empty_question = []
    empty_examples = []
    empty_constraints = []
    empty_topics = []
    empty_acceptance = []
    empty_similar = []
    empty_hints = []
    has_images = 0

    for f in files:
        with open(f) as fh:
            d = json.load(fh)

        slug = f.stem
        if not d.get("content_html"):
            empty_content.append(slug)
        if not d.get("question"):
            empty_question.append(slug)
        if not d.get("examples"):
            empty_examples.append(slug)
        if not d.get("constraints"):
            empty_constraints.append(slug)
        if not d.get("topics"):
            empty_topics.append(slug)
        if not d.get("acceptance_rate"):
            empty_acceptance.append(slug)
        if not d.get("similar_questions"):
            empty_similar.append(slug)
        if not d.get("hints"):
            empty_hints.append(slug)
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
    print(f"Failed (not scraped):     {failed_count}")
    print(f"Problems with images:     {has_images}")
    print()
    print("--- Empty field counts ---")
    print(f"Empty content_html:       {len(empty_content)}")
    print(f"Empty question:           {len(empty_question)}")
    print(f"Empty examples:           {len(empty_examples)}")
    print(f"Empty constraints:        {len(empty_constraints)}")
    print(f"Empty topics:             {len(empty_topics)}")
    print(f"Empty acceptance_rate:    {len(empty_acceptance)}")
    print(f"Empty similar_questions:  {len(empty_similar)} (may be legitimately empty)")
    print(f"Empty hints:              {len(empty_hints)} (may be legitimately empty)")
    print()

    # List problems with critical empty fields
    critical_empty = set(empty_content + empty_question + empty_examples + empty_constraints)
    if critical_empty:
        print(f"--- {len(critical_empty)} problems with critically empty fields ---")
        for slug in sorted(critical_empty):
            issues = []
            if slug in empty_content:
                issues.append("content")
            if slug in empty_question:
                issues.append("question")
            if slug in empty_examples:
                issues.append("examples")
            if slug in empty_constraints:
                issues.append("constraints")
            print(f"  {slug}: missing {', '.join(issues)}")
    else:
        print("No critically empty fields found!")

    print()
    completeness = (total - len(critical_empty)) / total * 100 if total else 0
    print(f"Data completeness: {completeness:.1f}% ({total - len(critical_empty)}/{total})")
    print("=" * 60)

    # Save report
    report = {
        "total_scraped": total,
        "failed_count": failed_count,
        "has_images": has_images,
        "empty_content": empty_content,
        "empty_question": empty_question,
        "empty_examples": empty_examples,
        "empty_constraints": empty_constraints,
        "empty_topics": empty_topics,
        "empty_acceptance": empty_acceptance,
        "critical_empty": sorted(critical_empty),
        "completeness_pct": round(completeness, 1),
    }
    with open(OUTPUT_DIR / "_report.json", "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nFull report saved to {OUTPUT_DIR / '_report.json'}")


if __name__ == "__main__":
    main()
