// Progress sync (signed-in users) + spaced-repetition scheduling.
// Signed-out users keep using localStorage ("leetcode-checked-items") as before;
// this layer is purely additive on top of that.

const LOCAL_KEY = "leetcode-checked-items";

// slug -> ISO solve timestamp
export type ProgressMap = Record<string, string>;

export async function fetchUserProgress(): Promise<ProgressMap> {
  try {
    const res = await fetch("/api/progress");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.progress || {};
  } catch (error) {
    console.error("fetchUserProgress failed:", error);
    return {};
  }
}

export async function updateQuestionProgress(slug: string, completed: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, completed }),
    });
    return res.ok;
  } catch (error) {
    console.error("updateQuestionProgress failed:", error);
    return false;
  }
}

export function getLocalProgress(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    localStorage.removeItem(LOCAL_KEY);
    return {};
  }
}

export function saveLocalProgress(progress: Record<string, boolean>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error("saveLocalProgress failed:", error);
  }
}

// --- Spaced repetition ---------------------------------------------------
// Stateless: a pure function of the solve date + how "fundamental/frequent" the
// question is (Amey's request). No cron, no email, no stored review state.
// A question becomes "due" once enough days have passed since it was solved;
// fundamental/frequent and harder questions come back SOONER (~6 days) than rare
// easy ones (~14 days). Re-solving (uncheck then re-check) resets the clock.
//
// We deliberately don't model a growing multi-step ladder: true spaced repetition
// needs per-review state we don't store, so a weighted recurring threshold is the
// honest, useful v1.
const BASE_REVIEW_DAYS = 14;
const DAY_MS = 86_400_000;

export function reviewStatus(
  solvedAtISO: string,
  freq: number,
  difficulty: string,
  now: number = Date.now()
): { isDue: boolean; nextReview: number } {
  const solved = new Date(solvedAtISO).getTime();
  if (!Number.isFinite(solved)) return { isDue: false, nextReview: Infinity };

  const diffScore = difficulty === "Hard" ? 1 : difficulty === "Medium" ? 0.5 : 0;
  // weight in [1, 2.5]: 30+ companies = max frequency signal.
  const weight = 1 + Math.min(freq / 30, 1) + 0.5 * diffScore;
  const intervalDays = Math.max(3, Math.round(BASE_REVIEW_DAYS / weight)); // ~6 .. 14
  const nextReview = solved + intervalDays * DAY_MS;
  return { isDue: now >= nextReview, nextReview };
}
