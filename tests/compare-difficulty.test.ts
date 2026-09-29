import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ComparisonPair } from "../lib/pseo-data";
import { buildCompareFaqs, difficultyPrepSentence } from "../lib/seo";

function company(
  slug: string,
  displayName: string,
  questionCount: number,
  hard: number,
): ComparisonPair["companyA"] {
  return {
    slug,
    displayName,
    questionCount,
    difficultyDist: { easy: 0, medium: 0, hard },
  };
}

function pair(
  a: { name: string; questionCount: number; hard: number },
  b: { name: string; questionCount: number; hard: number },
): ComparisonPair {
  return {
    pair: "a-vs-b",
    companyA: company("a", a.name, a.questionCount, a.hard),
    companyB: company("b", b.name, b.questionCount, b.hard),
    sharedCount: 0,
    uniqueToACount: 0,
    uniqueToBCount: 0,
    sharedProblems: [],
    exclusiveToA: [],
    exclusiveToB: [],
    topSharedTopics: [],
  };
}

describe("compare difficulty ties", () => {
  it("treats equal hard shares as a tie, including 1/2 and 2/4", () => {
    const data = pair(
      { name: "Northwind", questionCount: 2, hard: 1 },
      { name: "Contoso", questionCount: 4, hard: 2 },
    );
    const answer = buildCompareFaqs(data)[2].answer;
    assert.ok(answer.includes("same proportion"));
    assert.equal(answer.includes("higher proportion"), false);
    assert.equal(answer.includes("skews harder"), false);
    assert.ok(answer.includes("Northwind has 0 Easy, 0 Medium, and 1 Hard questions."));
    assert.ok(answer.includes("Contoso has 0 Easy, 0 Medium, and 2 Hard questions."));

    const prep = difficultyPrepSentence(data.companyA, data.companyB);
    assert.equal(prep.includes("Northwind"), false);
    assert.equal(prep.includes("Contoso"), false);
    assert.equal(prep.includes("skews harder"), false);
  });

  it("names the company with the strictly higher hard share", () => {
    const data = pair(
      { name: "Northwind", questionCount: 2, hard: 2 },
      { name: "Contoso", questionCount: 4, hard: 1 },
    );
    const answer = buildCompareFaqs(data)[2].answer;
    const prep = difficultyPrepSentence(data.companyA, data.companyB);

    assert.ok(answer.includes("Northwind"));
    assert.ok(answer.includes("higher proportion"));
    assert.ok(answer.includes("Northwind has a higher proportion of Hard problems"));
    assert.equal(answer.includes("Contoso has a higher proportion"), false);
    assert.equal(answer.includes("Contoso skews harder"), false);

    assert.ok(prep.includes("Northwind"));
    assert.ok(prep.includes("skews harder"));
    assert.equal(prep.includes("Contoso"), false);
  });

  it("treats zero question counts with zero hard questions as a tie", () => {
    const data = pair(
      { name: "Northwind", questionCount: 0, hard: 0 },
      { name: "Contoso", questionCount: 0, hard: 0 },
    );
    const answer = buildCompareFaqs(data)[2].answer;
    assert.ok(answer.includes("same proportion"));
    assert.equal(answer.includes("higher proportion"), false);

    const prep = difficultyPrepSentence(data.companyA, data.companyB);
    assert.equal(prep.includes("Northwind"), false);
    assert.equal(prep.includes("Contoso"), false);
    assert.equal(prep.includes("skews harder"), false);
  });
});
