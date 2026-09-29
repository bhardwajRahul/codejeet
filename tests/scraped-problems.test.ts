import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { loadScrapedProblems } from "../scripts/build-data";

const missingDirWarning =
  "No scraped problems found in data/problems/, continuing with CSV data only";

describe("loadScrapedProblems", () => {
  it("keeps valid problem files when one JSON file is bad", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "scraped-problems-"));
    const originalWarn = console.warn;
    const originalError = console.error;
    const warnings: unknown[][] = [];
    const errors: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };
    console.error = (...args: unknown[]) => {
      errors.push(args);
    };

    try {
      fs.writeFileSync(
        path.join(tempDir, "a-valid.json"),
        JSON.stringify({ slug: "alpha", title: "A" })
      );
      fs.writeFileSync(path.join(tempDir, "m-bad.json"), "{not json");
      fs.writeFileSync(path.join(tempDir, "z-valid.json"), JSON.stringify({ slug: "zeta" }));

      const map = await loadScrapedProblems(tempDir);
      assert.equal(map.has("alpha"), true);
      assert.equal(map.has("zeta"), true);
      assert.equal(
        warnings.some((args) => args.some((arg) => String(arg).includes("No scraped problems"))),
        false
      );
      assert.equal(
        errors.some((args) => args.some((arg) => String(arg).includes("m-bad.json"))),
        true
      );

      const missing = await loadScrapedProblems(path.join(tempDir, "does-not-exist"));
      assert.equal(missing.size, 0);
      assert.equal(
        warnings.some((args) => args.some((arg) => arg === missingDirWarning)),
        true
      );
    } finally {
      console.warn = originalWarn;
      console.error = originalError;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
