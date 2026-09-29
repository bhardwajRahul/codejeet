import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runAll } from "../lib/learn/runner";
import type { RunResult } from "../lib/learn/runner-types";
import type { TestCase } from "../lib/learn/types";

const testCase: TestCase = {
  name: "sample",
  stdin: "",
  expectedStdout: "ok\n",
  visible: true,
};

function runResult(exitCode: number, stdout: string): RunResult {
  return { ok: true, stdout, stderr: "", exitCode, durationMs: 1 };
}

describe("runAll exit status", () => {
  it("fails a matching stdout when the program exits nonzero", async () => {
    const outcome = await runAll("cpp", "int main(){return 1;}", [testCase], undefined, {
      run: async () => runResult(1, "ok\n"),
    });

    assert.equal(outcome.results[0]?.passed, false);
    assert.equal(outcome.passed, 0);
  });

  it("passes a matching stdout when the program exits 0", async () => {
    const outcome = await runAll("cpp", "int main(){return 0;}", [testCase], undefined, {
      run: async () => runResult(0, "ok\n"),
    });

    assert.equal(outcome.results[0]?.passed, true);
    assert.equal(outcome.passed, 1);
    assert.equal(outcome.allPassed, true);
  });

  it("fails a mismatched stdout even when the program exits 0", async () => {
    const outcome = await runAll("cpp", "int main(){return 0;}", [testCase], undefined, {
      run: async () => runResult(0, "nope\n"),
    });

    assert.equal(outcome.results[0]?.passed, false);
    assert.equal(outcome.passed, 0);
  });
});
