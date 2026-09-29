import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { runCode, terminateAllRunners, TOOLCHAIN_STALL_MS } from "../lib/learn/multi-runner";
import type { RunResult } from "../lib/learn/runner-types";

const EXEC_BUDGET_MS = 5000;
const EXEC_SLACK_MS = 1000;

class FakeWorker {
  static created: FakeWorker[] = [];
  url: string;
  terminated = false;
  posted: { id: number; type: string }[] = [];
  private listeners = new Map<string, ((event: { data: unknown }) => void)[]>();

  constructor(url: string) {
    this.url = url;
    FakeWorker.created.push(this);
  }

  addEventListener(type: string, fn: (event: { data: unknown }) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }

  postMessage(data: { id: number; type: string }) {
    this.posted.push(data);
  }

  terminate() {
    this.terminated = true;
  }

  emit(data: unknown) {
    for (const fn of this.listeners.get("message") ?? []) fn({ data });
  }
}

function installBrowser() {
  const g = globalThis as unknown as { window: unknown; Worker: unknown };
  g.window = globalThis;
  g.Worker = FakeWorker;
}

function latestWorker(): FakeWorker {
  const worker = FakeWorker.created.at(-1);
  assert.ok(worker, "runCode should construct a worker");
  return worker;
}

describe("toolchain stall timeout", () => {
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

  it("fails a C++ job that stays in loading-toolchain", async () => {
    let settled = false;
    const pending = runCode({
      language: "cpp",
      source: "int main(){return 0;}",
      stdin: "",
      timeoutMs: EXEC_BUDGET_MS,
    }).then((result) => {
      settled = true;
      return result;
    });
    const worker = latestWorker();
    worker.emit({
      id: worker.posted[0].id,
      type: "progress",
      progress: { phase: "loading-toolchain", loaded: 0, total: 0, message: "Downloading" },
    });

    mock.timers.tick(EXEC_BUDGET_MS + EXEC_SLACK_MS);
    await Promise.resolve();
    assert.equal(settled, false);

    mock.timers.tick(TOOLCHAIN_STALL_MS);
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /stalled/);
    assert.equal(worker.terminated, true);
  });

  it("fails a C++ job that stays in compiling and does not extend the stall on later progress", async () => {
    const pending = runCode({
      language: "cpp",
      source: "int main(){return 0;}",
      stdin: "",
      timeoutMs: EXEC_BUDGET_MS,
    });
    const worker = latestWorker();
    const id = worker.posted[0].id;
    worker.emit({ id, type: "progress", progress: { phase: "compiling" } });
    mock.timers.tick(TOOLCHAIN_STALL_MS - 1_000);
    worker.emit({ id, type: "progress", progress: { phase: "compiling" } });
    mock.timers.tick(1_000);
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /stalled/);
  });

  it("still kills an infinite loop after execution starts", async () => {
    const pending = runCode({
      language: "cpp",
      source: "for(;;){}",
      stdin: "",
      timeoutMs: EXEC_BUDGET_MS,
    });
    const worker = latestWorker();
    worker.emit({
      id: worker.posted[0].id,
      type: "progress",
      progress: { phase: "running" },
    });
    mock.timers.tick(EXEC_BUDGET_MS + EXEC_SLACK_MS);
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /Execution exceeded/);
  });

  it("does not fail a download that outlasts the execution budget and then finishes", async () => {
    let settled = false;
    const pending = runCode({
      language: "cpp",
      source: "int main(){return 0;}",
      stdin: "",
      timeoutMs: EXEC_BUDGET_MS,
    }).then((result) => {
      settled = true;
      return result;
    });
    const worker = latestWorker();
    const id = worker.posted[0].id;
    worker.emit({
      id,
      type: "progress",
      progress: { phase: "loading-toolchain", loaded: 1, total: 2 },
    });
    mock.timers.tick(EXEC_BUDGET_MS + EXEC_SLACK_MS + 5_000);
    await Promise.resolve();
    assert.equal(settled, false);

    const ok: RunResult = { ok: true, stdout: "ok\n", stderr: "", exitCode: 0, durationMs: 10 };
    worker.emit({ id, type: "progress", progress: { phase: "running" } });
    worker.emit({ id, type: "result", result: ok });
    const result = await pending;
    assert.deepEqual(result, ok);
    assert.equal(worker.terminated, false);
  });

  it("does not arm a main-thread stall timer for Java", async () => {
    let settled = false;
    const pending = runCode({
      language: "java",
      source: "class Main {}",
      stdin: "",
      timeoutMs: EXEC_BUDGET_MS,
    }).then((result) => {
      settled = true;
      return result;
    });
    const worker = latestWorker();
    worker.emit({
      id: worker.posted[0].id,
      type: "progress",
      progress: { phase: "loading-toolchain", loaded: 0, total: 0 },
    });
    mock.timers.tick(TOOLCHAIN_STALL_MS + EXEC_BUDGET_MS);
    await Promise.resolve();
    assert.equal(settled, false);
    terminateAllRunners();
    const result = await pending;
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /terminated by client/);
  });
});
