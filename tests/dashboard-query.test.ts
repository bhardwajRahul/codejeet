import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeDashboardData, type SourceQuestion } from "../lib/dashboard/encode";
import { decodeDashboardPayload } from "../lib/dashboard/decode";
import { computeStats, filterLinks, sortLinks, type QueryOptions } from "../lib/dashboard/query";

function q(overrides: Partial<SourceQuestion> = {}): SourceQuestion {
  return {
    slug: "two-sum",
    title: "Two Sum",
    difficulty: "Easy",
    company: "google",
    topics: ["Array", "Hash Table"],
    Topics: "Array, Hash Table",
    "Acceptance %": "54.3%",
    "Frequency %": "100.0%",
    "Is Premium": "N",
    timeframes: ["all"],
    ...overrides,
  };
}

const rows = [
  q(),
  q({
    company: "amazon",
    slug: "three-sum",
    title: "3Sum",
    difficulty: "Medium",
    topics: ["Array", "Two Pointers"],
    Topics: "Array, Two Pointers",
    "Frequency %": "40.0%",
    "Acceptance %": "32.1%",
    timeframes: ["all", "30_days"],
  }),
  q({
    company: "meta",
    slug: "lru-cache",
    title: "LRU Cache",
    difficulty: "Hard",
    topics: ["Design"],
    Topics: "Design",
    "Frequency %": "70.0%",
    "Acceptance %": "41.0%",
    "Is Premium": "Y",
    timeframes: ["6_months"],
  }),
];

const index = decodeDashboardPayload(encodeDashboardData(rows));

function opts(overrides: Partial<QueryOptions> = {}): QueryOptions {
  return {
    search: "",
    difficulties: [],
    topics: [],
    timeframe: "all",
    premium: "all",
    ...overrides,
  };
}

const titlesOf = (linkIndexes: number[]) =>
  linkIndexes.map((i) => index.problems[index.links[i][0]][1]);

describe("filterLinks", () => {
  it("returns everything when nothing is set", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts())), ["Two Sum", "3Sum", "LRU Cache"]);
  });

  it("matches search against title, company, and topic", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts({ search: "lru" }))), ["LRU Cache"]);
    assert.deepEqual(titlesOf(filterLinks(index, opts({ search: "amazon" }))), ["3Sum"]);
    assert.deepEqual(titlesOf(filterLinks(index, opts({ search: "two pointers" }))), ["3Sum"]);
  });

  it("requires every search word to match", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts({ search: "sum google" }))), ["Two Sum"]);
    assert.deepEqual(filterLinks(index, opts({ search: "sum meta" })), []);
  });

  it("ignores surrounding whitespace and case in the search", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts({ search: "  LRU  " }))), ["LRU Cache"]);
  });

  it("filters by difficulty as an OR set", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts({ difficulties: ["Easy", "Hard"] }))), [
      "Two Sum",
      "LRU Cache",
    ]);
  });

  it("filters by topic as an AND set", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts({ topics: ["Array"] }))), [
      "Two Sum",
      "3Sum",
    ]);
    assert.deepEqual(titlesOf(filterLinks(index, opts({ topics: ["Array", "Two Pointers"] }))), [
      "3Sum",
    ]);
  });

  it("treats the all timeframe as no filter at all", () => {
    assert.equal(filterLinks(index, opts({ timeframe: "all" })).length, 3);
  });

  it("filters by a specific timeframe", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts({ timeframe: "30_days" }))), ["3Sum"]);
    assert.deepEqual(titlesOf(filterLinks(index, opts({ timeframe: "6_months" }))), ["LRU Cache"]);
  });

  it("filters by premium access", () => {
    assert.deepEqual(titlesOf(filterLinks(index, opts({ premium: "free" }))), ["Two Sum", "3Sum"]);
    assert.deepEqual(titlesOf(filterLinks(index, opts({ premium: "premium" }))), ["LRU Cache"]);
  });
});

describe("sortLinks", () => {
  const all = filterLinks(index, opts());

  it("sorts by frequency descending", () => {
    assert.deepEqual(titlesOf(sortLinks(index, all, "desc", null)), [
      "Two Sum",
      "LRU Cache",
      "3Sum",
    ]);
  });

  it("sorts by frequency ascending", () => {
    assert.deepEqual(titlesOf(sortLinks(index, all, "asc", null)), [
      "3Sum",
      "LRU Cache",
      "Two Sum",
    ]);
  });

  it("sorts by acceptance when frequency is off", () => {
    assert.deepEqual(titlesOf(sortLinks(index, all, null, "desc")), [
      "Two Sum",
      "LRU Cache",
      "3Sum",
    ]);
  });

  it("treats an unknown acceptance as the lowest value", () => {
    const local = decodeDashboardPayload(
      encodeDashboardData([q({ "Acceptance %": "" }), q({ company: "meta" })])
    );
    const allLinks = filterLinks(local, opts());

    // Ascending: null must be first
    const asc = sortLinks(local, allLinks, null, "asc");
    assert.equal(local.problems[local.links[asc[0]][0]][3], null);

    // Descending: null must be last
    const desc = sortLinks(local, allLinks, null, "desc");
    assert.equal(local.problems[local.links[desc[desc.length - 1]][0]][3], null);
  });

  it("sorts by acceptance when frequency rankings would differ", () => {
    // Build a fixture where acceptance ranking (54.3 > 41.0) and frequency ranking
    // (70 > 100 when descending) would produce different sort orders.
    // Tests that we read acceptance column, not frequency.
    const local = decodeDashboardPayload(
      encodeDashboardData([
        q({ "Acceptance %": "41.0%", "Frequency %": "100.0%" }),
        q({ company: "amazon", "Acceptance %": "54.3%", "Frequency %": "70.0%" }),
      ])
    );
    const allLinks = filterLinks(local, opts());
    const sorted = sortLinks(local, allLinks, null, "desc");

    const acceptances = sorted.map((i) => local.problems[local.links[i][0]][3]);
    assert.deepEqual(acceptances, [54.3, 41.0]);
  });

  it("tie-breaks frequency and acceptance when both are set", () => {
    // Two rows with the same frequency, one row with different frequency.
    // When both sort orders are active, frequency must dominate the tie-break.
    const local = decodeDashboardPayload(
      encodeDashboardData([
        q({ slug: "freq-diff", "Frequency %": "100.0%", "Acceptance %": "50.0%" }),
        q({
          slug: "freq-same-a",
          company: "amazon",
          "Frequency %": "70.0%",
          "Acceptance %": "60.0%",
        }),
        q({
          slug: "freq-same-b",
          company: "meta",
          "Frequency %": "70.0%",
          "Acceptance %": "40.0%",
        }),
      ])
    );
    const allLinks = filterLinks(local, opts());
    const sorted = sortLinks(local, allLinks, "desc", "desc");

    const slugs = sorted.map((i) => local.problems[local.links[i][0]][0]);
    assert.equal(slugs[0], "freq-diff");
    assert.deepEqual(slugs.slice(1).sort(), ["freq-same-a", "freq-same-b"]);

    // The two frequency-tied rows must be ordered by acceptance (60 > 40).
    const tiedAcceptances = slugs.slice(1).map((slug) => {
      const linkIndex = allLinks.find((li) => local.problems[local.links[li][0]][0] === slug)!;
      return local.problems[local.links[linkIndex][0]][3];
    });
    assert.deepEqual(tiedAcceptances, [60.0, 40.0]);
  });

  it("does not mutate its input", () => {
    const input = [...all];
    sortLinks(index, input, "desc", null);

    assert.deepEqual(input, all);
  });
});

describe("computeStats", () => {
  it("counts unique slugs, not rows", () => {
    const local = decodeDashboardPayload(
      encodeDashboardData([q(), q({ company: "amazon" }), q({ company: "meta" })])
    );
    const stats = computeStats(local, filterLinks(local, opts()), {});

    assert.equal(stats.total, 1);
    assert.equal(stats.easy, 1);
  });

  it("counts solved per difficulty from the slug-keyed progress map", () => {
    const stats = computeStats(index, filterLinks(index, opts()), {
      "two-sum": true,
      "lru-cache": true,
      "three-sum": false,
    });

    assert.deepEqual(stats, {
      total: 3,
      totalSolved: 2,
      easy: 1,
      easySolved: 1,
      medium: 1,
      mediumSolved: 0,
      hard: 1,
      hardSolved: 1,
    });
  });

  it("returns zeroes for an empty result set", () => {
    assert.deepEqual(computeStats(index, [], {}), {
      total: 0,
      totalSolved: 0,
      easy: 0,
      easySolved: 0,
      medium: 0,
      mediumSolved: 0,
      hard: 0,
      hardSolved: 0,
    });
  });
});
