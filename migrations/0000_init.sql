-- One row per (user, question slug). Slug == question.ID, so a single row
-- covers every company that asks the question (mark once → marked everywhere).
-- solved_at is the FIRST-solve timestamp; it drives spaced-repetition and is
-- never overwritten on re-check, so the revision clock doesn't reset.
CREATE TABLE IF NOT EXISTS progress (
  user_id   TEXT NOT NULL,   -- Clerk user id
  slug      TEXT NOT NULL,   -- leetcode slug == question.ID
  solved_at TEXT NOT NULL,   -- ISO-8601 (UTC, e.g. 2026-06-23T10:00:00.000Z)
  PRIMARY KEY (user_id, slug)
);
