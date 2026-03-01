#!/bin/bash
# Autopilot: scrape all → retry failures → fix empties → report
set -e
cd "$(dirname "$0")"

echo "=========================================="
echo "PHASE 1: Main scrape (with resume)"
echo "=========================================="
uv run python scrape.py --resume --max-retries 3

echo ""
echo "=========================================="
echo "PHASE 2: Fix empty results (attempt 1)"
echo "=========================================="
uv run python scrape.py --fix-empty --max-retries 3

echo ""
echo "=========================================="
echo "PHASE 3: Fix empty results (attempt 2)"
echo "=========================================="
uv run python scrape.py --fix-empty --max-retries 3

echo ""
echo "=========================================="
echo "PHASE 4: Final retry of any failures"
echo "=========================================="
if [ -f output/_failed.json ]; then
    uv run python scrape.py --retry-failed --max-retries 3
else
    echo "No failures to retry!"
fi

echo ""
echo "=========================================="
echo "PHASE 5: Quality report"
echo "=========================================="
uv run python report.py
