import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { terminateAllRunners, TOOLCHAIN_STALL_MS } from "../lib/learn/multi-runner";
import { runAll } from "../lib/learn/runner";
import type { RunResult } from "../lib/learn/runner-types";
import type { TestCase } from "../lib/learn/types";

const tests: TestCase[] = [
  { stdin: "", expectedStdout: "one" },
  { stdin: "", expectedStdout: "two" },
  { stdin: "", expectedStdout: "three" },
];

class FakeWorker {
  static created: FakeWorker[] = [];
  posted: { id: number }[] = [];
  private listeners = new Map<string, ((event: { data: unknown }) => void)[]>();

  constructor(_url: string) {
    FakeWorker.created.push(this);
  }

  addEventListener(type: string, fn: (event: { data: unknown }) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  postMessage(data: { id: number }) {
    this.posted.push(data);
    // The first worker never answers. Later workers only exist when cancellation
    // failed to stop the suite; they finish so the test process does not hang.
    if (FakeWorker.created.length > 1) {
      this.emit({
        id: data.id,
        type: "result",
        result: {
          ok: true,
          stdout: "",
          stderr: "",
          exitCode: 0,
          durationMs: 1,
        } satisfies RunResult,
      });
    }
  }

  terminate() {}

  emit(data: unknown) {
    for (const fn of this.listeners.get("message") ?? []) fn({ data });
  }
}

function installBrowser() {
  const g = globalThis as unknown as { window: unknown; Worker: unknown };
  g.window = globalThis;
  g.Worker = FakeWorker;
}

describe("runAll stops after the lesson runner is terminated", () => {
  before(() => {
    installBrowser();
    mock.timers.enable({ apis: ["setTimeout"] });
  });

  after(() => {
    terminateAllRunners();
    mock.timers.reset();
  });

  beforeEach(() => {
    FakeWorker.created.length = 0;
    terminateAllRunners();
  });

  it("does not start remaining tests after terminateAllRunners", async () => {
    const pending = runAll("cpp", "int main(){return 0;}", tests);
    assert.equal(FakeWorker.created.length, 1);
    assert.equal(FakeWorker.created[0].posted.length, 1);

    terminateAllRunners();
    const outcome = await pending;

    assert.equal(FakeWorker.created.length, 1);
    assert.equal(outcome.results.length, 1);
  });

  it("still runs the next test when the worker is killed for a stalled job", async () => {
    const pending = runAll("cpp", "int main(){return 0;}", tests.slice(0, 2));
    assert.equal(FakeWorker.created.length, 1);

    mock.timers.tick(TOOLCHAIN_STALL_MS);
    const outcome = await pending;

    assert.equal(FakeWorker.created.length, 2);
    assert.equal(outcome.results.length, 2);
  });
});
