import type { LessonLanguage } from "./types";

const STORAGE_PREFIX = "codejeet:learn:v2:";
const DRAFT_DEBOUNCE_MS = 400;

interface SavedCode {
  code: string;
  savedAt: number;
}

interface PendingDraft {
  courseSlug: string;
  lessonSlug: string;
  language: LessonLanguage;
  code: string;
  timer: ReturnType<typeof setTimeout>;
}

let pending: PendingDraft | null = null;

function draftKey(courseSlug: string, lessonSlug: string, language: LessonLanguage): string {
  return `${STORAGE_PREFIX}${courseSlug}/${lessonSlug}/${language}`;
}

function sameTarget(
  draft: PendingDraft,
  courseSlug: string,
  lessonSlug: string,
  language: LessonLanguage
): boolean {
  return (
    draft.courseSlug === courseSlug &&
    draft.lessonSlug === lessonSlug &&
    draft.language === language
  );
}

function writeDraft(draft: Pick<PendingDraft, "courseSlug" | "lessonSlug" | "language" | "code">) {
  if (typeof window === "undefined") return;
  try {
    const payload: SavedCode = { code: draft.code, savedAt: Date.now() };
    window.localStorage.setItem(
      draftKey(draft.courseSlug, draft.lessonSlug, draft.language),
      JSON.stringify(payload)
    );
  } catch {
    // ignore quota errors
  }
}

export function loadLessonDraft(
  courseSlug: string,
  lessonSlug: string,
  language: LessonLanguage
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(draftKey(courseSlug, lessonSlug, language));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedCode;
    return parsed.code ?? null;
  } catch {
    return null;
  }
}

/** Write the pending draft now and cancel its debounce timer. */
export function flushLessonDraft() {
  if (!pending) return;
  const draft = pending;
  clearTimeout(draft.timer);
  pending = null;
  writeDraft(draft);
}

export function updateLessonDraft(
  courseSlug: string,
  lessonSlug: string,
  language: LessonLanguage,
  code: string
) {
  if (pending && !sameTarget(pending, courseSlug, lessonSlug, language)) {
    flushLessonDraft();
  }

  if (pending) {
    clearTimeout(pending.timer);
  }

  const draft: PendingDraft = {
    courseSlug,
    lessonSlug,
    language,
    code,
    timer: setTimeout(() => {
      if (pending !== draft) return;
      pending = null;
      writeDraft(draft);
    }, DRAFT_DEBOUNCE_MS),
  };
  pending = draft;
}
