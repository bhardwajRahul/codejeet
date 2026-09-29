import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const FLOOR = [7, 29, 1] as const;

function isPatchedUndici(version: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) return false;
  const parts = [Number(match[1]), Number(match[2]), Number(match[3])];
  for (let index = 0; index < FLOOR.length; index += 1) {
    if (parts[index] !== FLOOR[index]) return parts[index] > FLOOR[index];
  }
  return true;
}

function lockedUndiciVersions(lockfile: string): string[] {
  const versions = new Set<string>();
  for (const match of lockfile.matchAll(/^  undici@(\d+\.\d+\.\d+)(?=[(:])/gm)) {
    versions.add(match[1]);
  }
  for (const match of lockfile.matchAll(/^ {6}undici: (\d+\.\d+\.\d+)/gm)) {
    versions.add(match[1]);
  }
  return [...versions].sort();
}

describe("locked undici", () => {
  it("resolves every undici copy to 7.29.1 or later", async () => {
    const lockfile = await readFile("pnpm-lock.yaml", "utf8");
    const versions = lockedUndiciVersions(lockfile);
    assert.ok(versions.length > 0, "pnpm-lock.yaml resolves no undici package");
    for (const version of versions) {
      assert.equal(isPatchedUndici(version), true, `undici@${version} is below 7.29.1`);
    }
  });
});
