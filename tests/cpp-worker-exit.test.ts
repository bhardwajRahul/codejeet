import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";

interface WorkerResult {
  ok: boolean;
  message?: string;
  exitCode?: number;
  errorKind?: string;
}

interface PostedMessage {
  type: string;
  result?: WorkerResult;
}

const workerPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/learn-runtime/cpp-runner.worker.js"
);

describe("cpp runner worker exit status", () => {
  it("reports a nonzero WASI exit as a runtime failure and exit 0 as success", async () => {
    const source = readFileSync(workerPath, "utf8");
    const dynamicImports = source.match(/\bimport\s*\(/g);
    assert.ok(dynamicImports && dynamicImports.length > 0);
    const rewritten = source.replace(/\bimport\s*\(/g, "globalThis.__dynImport(");
    assert.equal(rewritten.includes("import("), false);

    const messages: PostedMessage[] = [];
    const listeners: Array<{ type: string; fn: (event: { data?: unknown }) => unknown }> = [];
    let starts = 0;

    class WASI {
      wasiImport: Record<string, never> = {};
      start(): void {
        starts += 1;
        if (starts === 1) throw { code: 1 };
      }
    }
    class File {}
    class OpenFile {}
    class ConsoleStdout {}
    class PreopenDirectory {}

    function __dynImport(specifier: unknown) {
      const url = String(specifier);
      if (url.includes("browsercc")) {
        return Promise.resolve({
          compile: async () => ({ module: {}, compileOutput: "" }),
        });
      }
      if (url.includes("browser_wasi_shim")) {
        return Promise.resolve({ WASI, File, OpenFile, ConsoleStdout, PreopenDirectory });
      }
      return Promise.reject(new Error(`unexpected dynamic import: ${url}`));
    }

    const sandbox = {
      self: {
        addEventListener(type: string, fn: (event: { data?: unknown }) => unknown) {
          listeners.push({ type, fn });
        },
        postMessage(message: PostedMessage) {
          messages.push(message);
        },
      },
      performance,
      TextEncoder,
      TextDecoder,
      WebAssembly: {
        instantiate: async () => ({}),
      },
      setTimeout,
      clearTimeout,
      Map,
      __dynImport,
    };
    runInContext(rewritten, createContext(sandbox));

    const listener = listeners.find((entry) => entry.type === "message");
    assert.ok(listener);

    const postRun = async (id: number) => {
      await listener.fn({
        data: {
          type: "run",
          id,
          source: "int main(){return 1;}",
          stdin: "",
          timeoutMs: 1000,
        },
      });
    };

    await postRun(1);
    const first = messages.filter((message) => message.type === "result").at(-1)?.result;
    assert.ok(first);
    assert.equal(first.ok, false);
    assert.match(first.message ?? "", /code 1/);
    assert.equal("exitCode" in first, false);

    await postRun(2);
    const second = messages.filter((message) => message.type === "result").at(-1)?.result;
    assert.ok(second);
    assert.equal(second.ok, true);
    assert.equal(second.exitCode, 0);
  });
});
