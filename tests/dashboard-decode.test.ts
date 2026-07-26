import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeDashboardData, type SourceQuestion } from "../lib/dashboard/encode";
import { decodeDashboardPayload, toDisplayRow } from "../lib/dashboard/decode";

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

const index = decodeDashboardPayload(
  encodeDashboardData([
    q(),
    q({
      company: "amazon",
      slug: "median-of-two-sorted-arrays",
      title: "Median of Two Sorted Arrays",
      difficulty: "Hard",
      topics: ["Array"],
      Topics: "Array",
      "Acceptance %": "",
      "Frequency %": "7.5%",
      "Is Premium": "Y",
    }),
  ])
);

describe("decodeDashboardPayload", () => {
  it("splits companies from their counts", () => {
    assert.deepEqual(index.companies, ["amazon", "google"]);
    assert.deepEqual(index.companyCounts, [1, 1]);
  });

  it("precomputes lowercase lookups so search does no work per keystroke", () => {
    assert.deepEqual(index.titleLower, ["two sum", "median of two sorted arrays"]);
    assert.deepEqual(index.companyLower, ["amazon", "google"]);
    assert.deepEqual(index.topicsLower, ["array", "hash table"]);
  });

  it("precomputes a topic index set per problem", () => {
    assert.deepEqual([...index.topicSets[0]].sort(), [0, 1]);
    assert.deepEqual([...index.topicSets[1]], [0]);
  });
});

describe("toDisplayRow", () => {
  it("rebuilds every rendered field", () => {
    assert.deepEqual(toDisplayRow(index, 0), {
      key: "0-1",
      slug: "two-sum",
      title: "Two Sum",
      path: "/problems/two-sum",
      difficulty: "Easy",
      company: "google",
      acceptance: "54.3%",
      frequency: "100.0%",
      topics: ["Array", "Hash Table"],
      premium: false,
    });
  });

  it("renders an unknown acceptance as a blank cell", () => {
    const row = toDisplayRow(index, 1);

    assert.equal(row.acceptance, "");
    assert.equal(row.frequency, "7.5%");
    assert.equal(row.difficulty, "Hard");
    assert.equal(row.premium, true);
  });

  it("gives every row a unique key", () => {
    const keys = index.links.map((_, i) => toDisplayRow(index, i).key);

    assert.equal(new Set(keys).size, keys.length);
  });
});
