import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { parse } from "csv-parse/sync";
import { importCompanies } from "../scripts/import-liquidslr.mjs";

const BROKEN = 'ID,URL,Title\n1,https://leetcode.com/problems/two-sum,"Two Sum\n';

describe("importCompanies", () => {
  it("does not replace an unreadable company file that is absent from the snapshot", async () => {
    const companiesDir = await mkdtemp(path.join(tmpdir(), "codejeet-companies-"));
    const liquidDir = await mkdtemp(path.join(tmpdir(), "codejeet-liquid-"));
    try {
      await writeFile(path.join(companiesDir, "acme.csv"), BROKEN, "utf8");

      importCompanies({ companiesDir, liquidDir });

      const raw = await readFile(path.join(companiesDir, "acme.csv"), "utf8");
      assert.equal(raw, BROKEN);
    } finally {
      await rm(companiesDir, { recursive: true, force: true });
      await rm(liquidDir, { recursive: true, force: true });
    }
  });

  it("still refreshes an unreadable company when the snapshot has that company", async () => {
    const companiesDir = await mkdtemp(path.join(tmpdir(), "codejeet-companies-"));
    const liquidDir = await mkdtemp(path.join(tmpdir(), "codejeet-liquid-"));
    try {
      await writeFile(path.join(companiesDir, "beta.csv"), BROKEN, "utf8");
      const folder = path.join(liquidDir, "Beta");
      await mkdir(folder);
      const liquid = [
        "Link,Title,Difficulty,Frequency,Topics",
        "https://leetcode.com/problems/two-sum,Two Sum,Easy,10,Array",
      ].join("\n");
      await writeFile(path.join(folder, "5. All.csv"), `${liquid}\n`, "utf8");

      importCompanies({ companiesDir, liquidDir });

      const raw = await readFile(path.join(companiesDir, "beta.csv"), "utf8");
      assert.equal(raw.includes("Quote Not Closed") || raw === BROKEN, false);
      const rows = parse(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: false,
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].Title, "Two Sum");
      assert.equal(rows[0].Topics, "Array");
      assert.equal(rows[0]["Acceptance %"], "");
    } finally {
      await rm(companiesDir, { recursive: true, force: true });
      await rm(liquidDir, { recursive: true, force: true });
    }
  });
});
