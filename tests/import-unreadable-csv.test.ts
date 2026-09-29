import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { parse } from "csv-parse/sync";
import { loadAllQuestions } from "../lib/data";
import { importCompanies } from "../scripts/import-liquidslr.mjs";

const BROKEN = 'ID,URL,Title\n1,https://leetcode.com/problems/two-sum,"Two Sum\n';

describe("importCompanies", () => {
  it("does not replace an unreadable company file that is absent from the snapshot", async () => {
    const companiesDir = await mkdtemp(path.join(tmpdir(), "codejeet-companies-"));
    const liquidDir = await mkdtemp(path.join(tmpdir(), "codejeet-liquid-"));
    try {
      await writeFile(path.join(companiesDir, "acme.csv"), BROKEN, "utf8");

      const logs: string[] = [];
      const originalLog = console.log;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
        originalLog(...args);
      };
      try {
        importCompanies({ companiesDir, liquidDir });
      } finally {
        console.log = originalLog;
      }

      const raw = await readFile(path.join(companiesDir, "acme.csv"), "utf8");
      assert.equal(raw, BROKEN);
      assert.match(logs.join("\n"), /Companies: 1 \(refreshed 0, kept 0, new 0, unreadable 1\)/);
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
      const rows = parse<Record<string, string>>(raw, {
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

  it("loads every company when each CSV parses", async () => {
    const companiesDir = await mkdtemp(path.join(tmpdir(), "codejeet-companies-"));
    try {
      const header = "ID,URL,Title,Difficulty,Acceptance %,Frequency %,Topics,Timeframe";
      const good =
        '1,https://leetcode.com/problems/two-sum,Two Sum,Easy,55.0%,12.0%,"Math, String",all';
      await writeFile(path.join(companiesDir, "b-good.csv"), `${header}\n${good}\n`, "utf8");

      const loaded = await loadAllQuestions(companiesDir);

      assert.deepEqual(loaded.companies, ["b-good"]);
      assert.equal(loaded.questions.length, 1);
      assert.equal(loaded.questions[0].title, "Two Sum");
      assert.equal(loaded.questions[0].company, "b-good");
    } finally {
      await rm(companiesDir, { recursive: true, force: true });
    }
  });

  it("refuses a company catalog when any CSV cannot be parsed", async () => {
    const companiesDir = await mkdtemp(path.join(tmpdir(), "codejeet-companies-"));
    const errors: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errors.push(args.map(String).join(" "));
      originalError(...args);
    };
    try {
      const header = "ID,URL,Title,Difficulty,Acceptance %,Frequency %,Topics,Timeframe";
      const good =
        '1,https://leetcode.com/problems/two-sum,Two Sum,Easy,55.0%,12.0%,"Math, String",all';
      await writeFile(path.join(companiesDir, "a-bad.csv"), BROKEN, "utf8");
      await writeFile(path.join(companiesDir, "b-good.csv"), `${header}\n${good}\n`, "utf8");
      await writeFile(path.join(companiesDir, "c-bad.csv"), BROKEN, "utf8");

      await assert.rejects(
        () => loadAllQuestions(companiesDir),
        (err: unknown) => {
          assert.ok(err instanceof Error);
          assert.match(err.message, /a-bad\.csv/);
          assert.match(err.message, /c-bad\.csv/);
          assert.doesNotMatch(err.message, /b-good\.csv/);
          return true;
        }
      );
      const logged = errors.join("\n");
      assert.match(logged, /Failed to load company a-bad\.csv:/);
      assert.match(logged, /Failed to load company c-bad\.csv:/);
    } finally {
      console.error = originalError;
      await rm(companiesDir, { recursive: true, force: true });
    }
  });
});
