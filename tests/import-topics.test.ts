import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { parse } from "csv-parse/sync";
import { importCompanies } from "../scripts/import-liquidslr.mjs";

describe("importCompanies", () => {
  it("keeps topic labels when the company is absent from the snapshot", async () => {
    const companiesDir = await mkdtemp(path.join(tmpdir(), "codejeet-companies-"));
    const liquidDir = await mkdtemp(path.join(tmpdir(), "codejeet-liquid-"));
    try {
      const header = "ID,URL,Title,Difficulty,Acceptance %,Frequency %,Topics,Timeframe";
      const row =
        '1,https://leetcode.com/problems/two-sum,Two Sum,Easy,55.0%,12.0%,"Math, String",all';
      await writeFile(path.join(companiesDir, "acme.csv"), `${header}\n${row}\n`, "utf8");

      importCompanies({ companiesDir, liquidDir });

      const raw = await readFile(path.join(companiesDir, "acme.csv"), "utf8");
      const rows = parse<Record<string, string>>(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: false,
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].Topics, "Math, String");
      assert.equal(rows[0]["Acceptance %"], "");
    } finally {
      await rm(companiesDir, { recursive: true, force: true });
      await rm(liquidDir, { recursive: true, force: true });
    }
  });

  it("uses snapshot topic labels when the company is in both directories", async () => {
    const companiesDir = await mkdtemp(path.join(tmpdir(), "codejeet-companies-"));
    const liquidDir = await mkdtemp(path.join(tmpdir(), "codejeet-liquid-"));
    try {
      const header = "ID,URL,Title,Difficulty,Acceptance %,Frequency %,Topics,Timeframe";
      const row =
        '1,https://leetcode.com/problems/two-sum,Two Sum,Easy,55.0%,12.0%,"Math, String",all';
      await writeFile(path.join(companiesDir, "acme.csv"), `${header}\n${row}\n`, "utf8");

      const folder = path.join(liquidDir, "Acme");
      await mkdir(folder);
      const liquid =
        "Link,Title,Difficulty,Frequency,Topics\nhttps://leetcode.com/problems/two-sum,Two Sum,Easy,12,Array\n";
      await writeFile(path.join(folder, "5. All.csv"), liquid, "utf8");

      importCompanies({ companiesDir, liquidDir });

      const raw = await readFile(path.join(companiesDir, "acme.csv"), "utf8");
      const rows = parse<Record<string, string>>(raw, {
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
        trim: false,
      });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].Topics, "Array");
      assert.equal(rows[0]["Acceptance %"], "");
      assert.equal(rows[0].ID, "1");
      assert.equal(rows[0].Title, "Two Sum");
    } finally {
      await rm(companiesDir, { recursive: true, force: true });
      await rm(liquidDir, { recursive: true, force: true });
    }
  });
});
