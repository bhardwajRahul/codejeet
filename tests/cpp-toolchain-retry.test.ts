import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";

interface PostedMessage {
  type: string;
  result?: { ok: boolean; message?: string };
}

const workerPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../public/learn-runtime/cpp-runner.worker.js"
);

describe("cpp toolchain download retry", () => {
  it("imports the toolchain again after a rejected download", async () => {
    const source = readFileSync(workerPath, "utf8");
    const dynamicImports = source.match(/\bimport\s*\(/g);
    assert.ok(dynamicImports && dynamicImports.length > 0);
    const rewritten = source.replace(/\bimport\s*\(/g, "globalThis.__dynImport(");
    assert.equal(rewritten.includes("import("), false);

    const messages: PostedMessage[] = [];
    const listeners: Array<{ type: string; fn: (event: { data?: unknown }) => unknown }> = [];
    let browserccImports = 0;

    function __dynImport(specifier: unknown) {
      const url = String(specifier);
      if (url.includes("browsercc")) {
        browserccImports += 1;
        if (browserccImports === 1) return Promise.reject(new Error("network down"));
        return Promise.resolve({
          compile: async () => ({ module: null, compileOutput: "recovered" }),
        });
      }
      throw new Error(`unexpected dynamic import: ${url}`);
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
      WebAssembly: { instantiate: async () => ({}) },
      setTimeout,
      clearTimeout,
      Map,
      __dynImport,
      globalThis: {},
    };
    sandbox.globalThis = sandbox;
    runInContext(rewritten, createContext(sandbox));

    const listener = listeners.find((entry) => entry.type === "message");
    assert.ok(listener);

    const postRun = async (id: number) => {
      await listener.fn({
        data: { type: "run", id, source: "int main(){return 0;}", stdin: "", timeoutMs: 1000 },
      });
    };

    await postRun(1);
    const first = messages.filter((message) => message.type === "result").at(-1)?.result;
    assert.ok(first);
    assert.equal(first.ok, false);
    assert.match(first.message ?? "", /network down/);
    assert.equal(browserccImports, 1);

    await postRun(2);
    const second = messages.filter((message) => message.type === "result").at(-1)?.result;
    assert.ok(second);
    assert.equal(browserccImports, 2);
    assert.match(second.message ?? "", /Compilation failed/);
  });
});
