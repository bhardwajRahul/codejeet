// Self-check for the spaced-repetition scheduler. Run: bunx tsx scripts/check-review.ts
import assert from "node:assert";
import { reviewStatus } from "../utils/progressUtils";

const t0 = Date.parse("2026-01-01T00:00:00.000Z");
const day = 86_400_000;

// Just solved: not due yet.
assert.equal(reviewStatus(new Date(t0).toISOString(), 0, "Easy", t0).isDue, false);

// Rare/Easy comes due around ~14 days; fundamental/Hard comes due sooner (~6).
assert.equal(reviewStatus(new Date(t0).toISOString(), 0, "Easy", t0 + 10 * day).isDue, false);
assert.equal(reviewStatus(new Date(t0).toISOString(), 50, "Hard", t0 + 10 * day).isDue, true);

// Fundamental/frequent + Hard is scheduled sooner than a rare/easy one.
const hot = reviewStatus(new Date(t0).toISOString(), 50, "Hard", t0).nextReview;
const cold = reviewStatus(new Date(t0).toISOString(), 0, "Easy", t0).nextReview;
assert.ok(hot < cold, "high freq/difficulty should be due sooner");

// Everything is due eventually.
assert.equal(reviewStatus(new Date(t0).toISOString(), 0, "Easy", t0 + 30 * day).isDue, true);

// Garbage date never crashes / never due.
assert.equal(reviewStatus("not-a-date", 10, "Medium", t0).isDue, false);

console.log("reviewStatus self-check passed");
