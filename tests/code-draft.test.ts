import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import { flushLessonDraft, loadLessonDraft, updateLessonDraft } from "../lib/learn/code-draft";

const store = new Map<string, string>();

const memoryStorage = {
  getItem(key: string): string | null {
    return store.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    store.set(key, String(value));
  },
  removeItem(key: string) {
    store.delete(key);
  },
  clear() {
    store.clear();
  },
};

const globals = globalThis as typeof globalThis & {
  window?: { localStorage: typeof memoryStorage };
};
const hadWindow = "window" in globalThis;
const originalWindow = globals.window;

function draftKey(courseSlug: string, lessonSlug: string, language: string) {
  return `codejeet:learn:v2:${courseSlug}/${lessonSlug}/${language}`;
}

before(() => {
  globals.window = { localStorage: memoryStorage };
  mock.timers.enable({ apis: ["setTimeout"] });
});

beforeEach(() => {
  flushLessonDraft();
  store.clear();
});

after(() => {
  flushLessonDraft();
  mock.timers.reset();
  if (hadWindow) {
    globals.window = originalWindow;
  } else {
    delete globals.window;
  }
});

describe("lesson code drafts", () => {
  it("writes the latest same-language edit 400ms after the second update", () => {
    const course = "arrays-easy";
    const lesson = "01-largest-element";
    const key = draftKey(course, lesson, "cpp");

    updateLessonDraft(course, lesson, "cpp", "first");
    mock.timers.tick(200);
    updateLessonDraft(course, lesson, "cpp", "second");
    mock.timers.tick(399);
    assert.equal(store.has(key), false);

    mock.timers.tick(1);
    const raw = store.get(key);
    assert.ok(raw);
    const parsed = JSON.parse(raw) as { code?: string };
    assert.equal(parsed.code, "second");
    assert.equal(key.startsWith("codejeet:learn:v2:"), true);
    assert.equal(key.endsWith("/cpp"), true);
  });

  it("flushes the previous language immediately and debounces the new one", () => {
    const course = "arrays-easy";
    const lesson = "01-largest-element";

    updateLessonDraft(course, lesson, "cpp", "hello");
    updateLessonDraft(course, lesson, "python", "py");

    assert.equal(loadLessonDraft(course, lesson, "cpp"), "hello");
    assert.notEqual(loadLessonDraft(course, lesson, "python"), "hello");

    mock.timers.tick(400);
    assert.equal(loadLessonDraft(course, lesson, "python"), "py");
    assert.equal(loadLessonDraft(course, lesson, "cpp"), "hello");
  });

  it("flushLessonDraft writes the pending draft without waiting for the timer", () => {
    const course = "arrays-easy";
    const lesson = "01-largest-element";

    updateLessonDraft(course, lesson, "cpp", "zz");
    flushLessonDraft();

    assert.equal(loadLessonDraft(course, lesson, "cpp"), "zz");
    assert.notEqual(loadLessonDraft(course, lesson, "python"), "zz");
  });
});
