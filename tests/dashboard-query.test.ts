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
    const sorted = sortLinks(local, filterLinks(local, opts()), null, "asc");

    assert.equal(local.problems[local.links[sorted[0]][0]][3], null);
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
