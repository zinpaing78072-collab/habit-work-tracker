import type { Entry, Goal, Group, Habit } from "./types";

/**
 * Default habits, in the order used in the source notes.
 * `unit` is intentionally blank for habits where the notes do not state one.
 */
export const SEED_HABITS: Habit[] = [
  { slug: "meditation", name: "Meditation", kind: "numeric", unit: "min", steps: [1, 5, 10], order: 0, archived: false, groupSlug: "health" },
  { slug: "self-remembering", name: "Self Remembering", kind: "numeric", unit: "", steps: [25, 50, 100], order: 1, archived: false, groupSlug: "mind" },
  { slug: "writing", name: "Writing", kind: "numeric", unit: "", steps: [1, 5, 10], order: 2, archived: false, groupSlug: "work" },
  { slug: "algebra", name: "Algebra Driven Design", kind: "numeric", unit: "min", steps: [5, 10, 20], order: 3, archived: false, groupSlug: "work" },
  { slug: "retention", name: "Retention", kind: "binary", unit: "", steps: [], order: 4, archived: false, groupSlug: "health" },
  { slug: "fasting", name: "Fasting", kind: "binary", unit: "", steps: [], order: 5, archived: false, groupSlug: "health" },
  { slug: "vocabulary", name: "Vocabulary", kind: "numeric", unit: "words", steps: [5, 10, 25], order: 6, archived: false, groupSlug: "learning" },
  { slug: "reading", name: "Reading", kind: "numeric", unit: "pages", steps: [1, 5, 10], order: 7, archived: false, groupSlug: "learning" },
  { slug: "bootstrap", name: "Bootstrap", kind: "numeric", unit: "", steps: [10, 30, 60], order: 8, archived: false, groupSlug: "work" },
];



/** Default groups, in display order. */
export const SEED_GROUPS: Group[] = [
  { slug: "health", name: "Health", order: 0, archived: false },
  { slug: "work", name: "Work", order: 1, archived: false },
  { slug: "learning", name: "Learning", order: 2, archived: false },
  { slug: "mind", name: "Mind", order: 3, archived: false },
];

/**
 * Goals from the notes. Every target is a RANGE TOTAL (Q6), never per-day.
 *
 * Active goals come from the `Goal ...` lines. Completed goals come from the
 * `Completed ...` lines and are seeded as inactive, locked records (Q12/D) so
 * their history survives into Stage 2. Where the notes only give the achieved
 * amount for a completed goal, `target` is set to that amount so the record
 * reads as met.
 */
export const SEED_GOALS: Goal[] = [
  // ---- active goals ----
  { habitSlug: "meditation", target: 200, startDate: "2026-10-02", endDate: "2026-10-11", active: true },
  { habitSlug: "self-remembering", target: 500, startDate: "2026-09-29", endDate: "2026-10-03", active: true },
  { habitSlug: "writing", target: 100, startDate: "2026-09-28", endDate: "2026-10-02", active: true },
  { habitSlug: "algebra", target: 480, startDate: "2026-09-29", endDate: "2026-10-09", active: true },
  { habitSlug: "retention", target: 3, startDate: "2026-09-24", endDate: "2026-09-29", active: true },
  { habitSlug: "fasting", target: 3, startDate: "2026-09-24", endDate: "2026-09-29", active: true },
  { habitSlug: "vocabulary", target: 250, startDate: "2026-09-28", endDate: "2026-10-08", active: true },
  { habitSlug: "reading", target: 10, startDate: "2026-10-01", endDate: "2026-10-10", active: true },
  { habitSlug: "bootstrap", target: 600, startDate: "2026-09-25", endDate: "2026-10-05", active: true },

  // ---- completed (locked) goals ----
  { habitSlug: "meditation", target: 332, startDate: "2026-09-22", endDate: "2026-10-01", active: false, completedAt: "2026-10-01", result: 332 },
  { habitSlug: "meditation", target: 124, startDate: "2026-09-17", endDate: "2026-09-21", active: false, completedAt: "2026-09-21", result: 124 },
  { habitSlug: "vocabulary", target: 295, startDate: "2026-09-17", endDate: "2026-09-27", active: false, completedAt: "2026-09-27", result: 295 },
  { habitSlug: "reading", target: 5, startDate: "2026-09-25", endDate: "2026-09-30", active: false, completedAt: "2026-09-30", result: 5 },
  { habitSlug: "algebra", target: 200, startDate: "2026-09-23", endDate: "2026-09-28", active: false, completedAt: "2026-09-28", result: 200 },
];

/**
 * Seeded daily values, September-October 2026.
 * Duplicate handwritten lines for the same date are COMBINED (Q15):
 * e.g. 22.9 = 10 + 20 = 30.
 */
const SEED_ENTRIES: Record<string, Record<string, number>> = {
  meditation: {
    "2026-09-22": 30, // 10 + 20
    "2026-09-23": 46, // 29 + 17
    "2026-09-24": 66, // 36 + 30
    "2026-09-25": 27, // 10 + 17
    "2026-09-26": 46, // 31 + 15
    "2026-09-27": 13,
    "2026-09-28": 31, // 21 + 10
    "2026-09-30": 33, // 14 + 19
    "2026-10-01": 40, // 27 + 13
    "2026-10-02": 52, // 27 + 25
    "2026-10-03": 20,
    "2026-10-04": 10,
  },
  "self-remembering": {
    "2026-09-29": 100,
    "2026-09-30": 100,
    "2026-10-01": 100,
    "2026-10-02": 100,
    "2026-10-03": 60,
  },
  writing: {
    "2026-10-03": 22, // 11 + 11
  },
  algebra: {
    "2026-09-29": 60,
    "2026-10-02": 15,
    "2026-10-03": 63, // 36 + 27
  },
  retention: {
    "2026-09-24": 0,
    "2026-09-25": 1,
    "2026-09-26": 0,
    "2026-09-27": 0,
    "2026-09-28": 1,
    "2026-09-29": 0,
    "2026-09-30": 1,
  },
  fasting: {
    "2026-09-24": 1,
    "2026-09-25": 0,
    "2026-09-26": 0,
    "2026-09-27": 0,
    "2026-09-28": 0,
    "2026-09-29": 0,
    "2026-09-30": 0,
    "2026-10-01": 0,
  },
  vocabulary: {
    "2026-09-17": 25,
    "2026-09-18": 25,
    "2026-09-19": 25,
    "2026-09-21": 50,
    "2026-09-22": 25,
    "2026-09-24": 50,
    "2026-09-25": 25,
    "2026-09-26": 40,
    "2026-09-27": 30,
    "2026-09-30": 10,
    "2026-10-01": 15,
  },
  reading: {
    "2026-09-25": 1,
    "2026-09-26": 1,
    "2026-09-28": 1,
    "2026-09-30": 2,
  },
  bootstrap: {
    "2026-09-25": 90,
    "2026-09-26": 60,
    "2026-09-30": 90,
  },
};

export function buildSeedEntries(): Entry[] {
  const now = Date.now();
  const out: Entry[] = [];
  for (const [habitSlug, byDate] of Object.entries(SEED_ENTRIES)) {
    for (const [date, value] of Object.entries(byDate)) {
      out.push({ habitSlug, date, value, explicit: true, updatedAt: now });
    }
  }
  return out;
}

