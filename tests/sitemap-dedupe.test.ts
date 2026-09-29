import assert from "node:assert/strict";
import { statSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import sitemap from "../app/sitemap";
import { compareCollisionKey, dedupeSitemapEntries } from "../lib/sitemap/dedupe";
import { SITE_URL } from "../lib/site";

const generatedPath = path.join(process.cwd(), "lib", "sitemap", "generated.ts");
const generatedMtime = statSync(generatedPath).mtimeMs;

const collisions = [
  ["/compare/atlassian-vs-j-p-morgan", "/compare/atlassian-vs-jpmorgan"],
  ["/compare/autodesk-vs-media-net", "/compare/autodesk-vs-medianet"],
  ["/compare/google-vs-apollo-io", "/compare/google-vs-apolloio"],
  ["/compare/google-vs-booking-com", "/compare/google-vs-bookingcom"],
  ["/compare/google-vs-machine-zone", "/compare/google-vs-machinezone"],
  ["/compare/google-vs-otter-ai", "/compare/google-vs-otterai"],
  ["/compare/google-vs-pony-ai", "/compare/google-vs-ponyai"],
  ["/compare/google-vs-sumo-logic", "/compare/google-vs-sumologic"],
  ["/compare/google-vs-j-p-morgan", "/compare/google-vs-jpmorgan"],
] as const;

const uniques = [
  "/compare/google-vs-meta",
  "/compare/google-vs-amazon",
  "/compare/atlassian-vs-de-shaw",
  "/compare/google-vs-at-t",
  "/compare/google-vs-t-mobile",
  "/company/jpmorgan",
  "/company/j-p-morgan",
  "/compare",
] as const;

function hyphenCount(urlPath: string): number {
  return urlPath.split("-").length - 1;
}

function entry(urlPath: string, priority: number) {
  return { path: urlPath, priority, changeFrequency: "monthly" as const };
}

function collisionInput() {
  return [
    ...collisions.map(([extra]) => entry(extra, 0.2)),
    ...uniques.map((urlPath) => entry(urlPath, 0.5)),
    ...collisions.map(([, kept]) => entry(kept, 0.8)),
  ];
}

describe("compareCollisionKey", () => {
  it("is null unless the path is one compare segment", () => {
    assert.equal(compareCollisionKey("/compare"), null);
    assert.equal(compareCollisionKey("/compare/"), null);
    assert.equal(compareCollisionKey("/company/jpmorgan"), null);
    assert.equal(compareCollisionKey("/company/j-p-morgan"), null);
    assert.equal(compareCollisionKey("/compare/google-vs-meta/extra"), null);
  });

  it("shares a key only for known company spellings", () => {
    assert.equal(
      compareCollisionKey("/compare/atlassian-vs-j-p-morgan"),
      compareCollisionKey("/compare/atlassian-vs-jpmorgan")
    );
    assert.equal(compareCollisionKey("/compare/atlassian-vs-jpmorgan"), "atlassian-vs-jpmorgan");
    assert.equal(
      compareCollisionKey("/compare/google-vs-j-p-morgan"),
      compareCollisionKey("/compare/google-vs-jpmorgan")
    );
    assert.notEqual(
      compareCollisionKey("/compare/google-vs-meta"),
      compareCollisionKey("/compare/google-vs-amazon")
    );
    assert.notEqual(compareCollisionKey("/compare/ab-c"), compareCollisionKey("/compare/a-bc"));
    assert.equal(compareCollisionKey("/compare/atlassian-vs-de-shaw"), "atlassian-vs-de-shaw");
    assert.equal(compareCollisionKey("/compare/google-vs-at-t"), "google-vs-at-t");
    assert.equal(compareCollisionKey("/compare/google-vs-t-mobile"), "google-vs-t-mobile");
  });
});

describe("dedupeSitemapEntries", () => {
  it("keeps one fewer-hyphen compare path and leaves unique and company paths", () => {
    const result = dedupeSitemapEntries(collisionInput());
    const paths = result.map((item) => item.path);
    const kept = collisions.map(([, winner]) => winner);

    assert.deepEqual(paths, [...kept, ...uniques]);
    for (const [extra, winner] of collisions) {
      assert.ok(hyphenCount(winner) < hyphenCount(extra));
      assert.equal(paths.filter((urlPath) => urlPath === winner).length, 1);
      assert.equal(paths.includes(extra), false);
    }
    for (const item of result) {
      if (kept.includes(item.path)) assert.equal(item.priority, 0.8);
    }
  });

  it("keeps compare paths whose names are not two spellings of one company", () => {
    const result = dedupeSitemapEntries([
      entry("/compare/ab-c", 1),
      entry("/compare/a-bc", 2),
      entry("/compare/atlassian-vs-de-shaw", 3),
      entry("/compare/google-vs-at-t", 4),
      entry("/compare/google-vs-t-mobile", 5),
    ]);
    assert.deepEqual(
      result.map((item) => item.path),
      [
        "/compare/ab-c",
        "/compare/a-bc",
        "/compare/atlassian-vs-de-shaw",
        "/compare/google-vs-at-t",
        "/compare/google-vs-t-mobile",
      ]
    );
  });
});

describe("assembleSitemapEntries", () => {
  it("dedupes compare paths without writing the generated sitemap", async () => {
    const { assembleSitemapEntries } = await import("../scripts/build-sitemap");
    assert.equal(statSync(generatedPath).mtimeMs, generatedMtime);

    const entries = await assembleSitemapEntries(collisionInput());
    assert.equal(statSync(generatedPath).mtimeMs, generatedMtime);

    const paths = entries.map((item) => item.path);
    for (const [extra, winner] of collisions) {
      assert.equal(paths.filter((urlPath) => urlPath === winner).length, 1);
      assert.equal(paths.includes(extra), false);
    }
    for (const urlPath of uniques) assert.equal(paths.includes(urlPath), true);
  });
});

describe("sitemap response", () => {
  it("drops hyphen collisions from the shipped urls and keeps compare files", () => {
    const urls = new Set(sitemap().map((item) => item.url));
    const hyphenated = `${SITE_URL}/compare/atlassian-vs-j-p-morgan`;
    const keptJp = `${SITE_URL}/compare/atlassian-vs-jpmorgan`;
    const keptMedia = `${SITE_URL}/compare/autodesk-vs-medianet`;

    assert.equal(urls.has(hyphenated) && urls.has(keptJp), false);
    assert.equal(urls.has(keptJp), true);
    assert.equal(urls.has(keptMedia), true);
    assert.equal(urls.has(`${SITE_URL}/company/jpmorgan`), true);
    assert.equal(urls.has(`${SITE_URL}/company/j-p-morgan`), true);
    assert.equal(urls.has(`${SITE_URL}/compare/atlassian-vs-de-shaw`), true);
    assert.equal(urls.has(`${SITE_URL}/compare/google-vs-jpmorgan`), true);
    assert.equal(urls.has(`${SITE_URL}/compare/google-vs-j-p-morgan`), false);
  });
});
