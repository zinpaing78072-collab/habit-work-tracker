import type { AppState, Entry, Goal, Habit } from "./types";
import { inRange, logicalToday } from "./day";

export type Progress = {
  total: number;
  target: number;
  remaining: number;
  /** 0..1, clamped. */
  ratio: number;
  met: boolean;
  /** No active goal defined for this habit. */
  hasGoal: boolean;
  goal?: Goal;
  expired: boolean;
};

export function activeGoalFor(state: AppState, habitSlug: string): Goal | undefined {
  return state.goals.find((g) => g.habitSlug === habitSlug && g.active);
}

/** Completed (locked) goals for a habit, newest first (Q10/B, Q12/D). */
export function completedGoalsFor(state: AppState, habitSlug: string): Goal[] {
  return state.goals
    .filter((g) => g.habitSlug === habitSlug && !g.active)
    .sort((a, b) => b.endDate.localeCompare(a.endDate));
}

/** Today's value for a habit; missing is derived as 0 (Q2/Q22). */
export function valueOn(state: AppState, habitSlug: string, date: string): number {
  return state.entries.find((e) => e.habitSlug === habitSlug && e.date === date)?.value ?? 0;
}

/**
 * "Logged" (Q22/A): a record exists AND (non-zero OR explicitly set to 0/fail).
 * Binary Fail is logged; a missing record is not.
 */
export function isLoggedOn(state: AppState, habitSlug: string, date: string): boolean {
  const e = state.entries.find((x) => x.habitSlug === habitSlug && x.date === date);
  if (!e) return false;
  return e.value !== 0 || e.explicit;
}

/** Colour for a metric card: TODAY-ONLY (Q9/B). */
export function todayTone(state: AppState, habit: Habit, date: string): "green" | "red" {
  return isLoggedOn(state, habit.slug, date) && valueOn(state, habit.slug, date) !== 0 ? "green" : "red";
}

/**
 * Range-total progress (Q6): sum of values inside the goal range, uniformly for
 * every habit type. For binary habits the sum of 1s is the success count (Q8).
 */
export function progressFor(state: AppState, habit: Habit, today = logicalToday(state.settings.dayStartHour)): Progress {
  const goal = activeGoalFor(state, habit.slug);
  if (!goal) {
    return { total: 0, target: 0, remaining: 0, ratio: 0, met: false, hasGoal: false, expired: false };
  }
  const scoped: Entry[] = state.entries.filter(
    (e) => e.habitSlug === habit.slug && inRange(e.date, goal.startDate, goal.endDate),
  );
  const total = scoped.reduce((sum, e) => sum + e.value, 0);
  const target = goal.target;
  const remaining = Math.max(target - total, 0);
  const ratio = target > 0 ? Math.min(total / target, 1) : 0;
  return {
    total,
    target,
    remaining,
    ratio,
    met: total >= target,
    hasGoal: true,
    goal,
    expired: today > goal.endDate,
  };
}

export function loggedCount(state: AppState, date: string, habits = state.habits.filter((h) => !h.archived)): number {
  return habits.filter((h) => isLoggedOn(state, h.slug, date)).length;
}

/** All today's habits are green -> the moment to prompt an export (Q14). */
export function allGreenToday(state: AppState, date: string): boolean {
  const habits = state.habits.filter((h) => !h.archived);
  if (habits.length === 0) return false;
  return habits.every((h) => todayTone(state, h, date) === "green");
}

/** True when there are edits newer than the last export (Q14/C). */
export function hasUnbackedChanges(state: AppState): boolean {
  if (state.settings.lastExportAt === null) return state.entries.length > 0;
  const last = state.settings.lastExportAt;
  return state.entries.some((e) => e.updatedAt > last);
}
