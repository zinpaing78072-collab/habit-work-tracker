/** Habit type. Numeric = a measured amount; Binary = success/fail per day. */
export type HabitKind = "numeric" | "binary";

/** A first-class habit. `slug` is immutable so history and CSV filenames never break. */
export type Habit = {
  slug: string;
  name: string;
  kind: HabitKind;
  /** Display unit for numeric habits, e.g. "min", "words", "pages". */
  unit: string;
  /** Steppers shown next to the input: e.g. [1, 5] for minutes. */
  steps: number[];
  order: number;
  archived: boolean;
};

/** A goal is a target total over a date range. Only one active goal per habit. */
export type Goal = {
  habitSlug: string;
  target: number;
  /** Inclusive YYYY-MM-DD. */
  startDate: string;
  /** Inclusive YYYY-MM-DD. */
  endDate: string;
  active: boolean;
  /**
   * Set once the end date passes. Completed goals are locked and immutable
   * (Q12/D). `result` caches the final progress at completion time.
   */
  completedAt?: string;
  result?: number;
};

/**
 * One record per (habit, logical day).
 *
 * Missing values are NOT stored (Q: derived as 0 on read). Existence of a
 * record is what makes a day "logged" (Q22/A):
 *  - numeric: value > 0, or an explicit 0 entry with `explicit` true
 *  - binary:  value 1 = Success, value 0 = explicit Fail, both logged
 */
export type Entry = {
  habitSlug: string;
  /** Logical day, YYYY-MM-DD (see day.ts). */
  date: string;
  value: number;
  /** True when the user deliberately set this value (including 0 / Fail). */
  explicit: boolean;
  updatedAt: number;
};

export type Settings = {
  /**
   * Global "day starts at" hour (Q17/A, Q18 default 4). Changing this affects
   * new entries only — existing entries keep their stored logical day.
   */
  dayStartHour: number;
  /** Timestamp of the last successful export, used for the unbacked-changes flag. */
  lastExportAt: number | null;
};

export type View = "today" | "history" | "goals" | "settings";

export type AppState = {
  habits: Habit[];
  goals: Goal[];
  entries: Entry[];
  settings: Settings;
  view: View;
  /** Logical day currently being edited. */
  editingDate: string;
  /** History range filter (persisted so it survives re-renders). */
  historyFrom: string;
  historyTo: string;
  /** First-run dismissible banner about seeded data (Q23/A). */
  seedNoticeDismissed: boolean;
};
