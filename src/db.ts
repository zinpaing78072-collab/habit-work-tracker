import type { AppState, Entry, Goal, Group, Habit, Settings, View } from "./types";
import { addDays, DEFAULT_DAY_START_HOUR, logicalToday } from "./day";
import { SEED_GOALS, SEED_GROUPS, SEED_HABITS, buildSeedEntries } from "./seed";

/**
 * Minimal typed IndexedDB wrapper. Single object store "state" holding the whole
 * app document: simple, small, and keeps every read/write atomic so we never
 * persist a half-updated state.
 */
const DB_NAME = "habit-work-tracker";
const DB_VERSION = 1;
const STORE = "state";
const STATE_KEY = "current";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
  });
  return dbPromise;
}

export function defaultState(): AppState {
  const today = logicalToday();
  return {
    habits: SEED_HABITS,
    goals: SEED_GOALS,
    entries: buildSeedEntries(),
    settings: { dayStartHour: DEFAULT_DAY_START_HOUR, lastExportAt: null },
    view: "today",
    editingDate: today,
    editingHabitSlug: null,
    editingGroupSlug: null,
    dayStartTotals: null,
    historyFrom: addDays(today, -29),
    historyTo: today,
    seedNoticeDismissed: false,
    groups: SEED_GROUPS,
    collapsedGroupSlugs: [],
  };
}

/** Load state, seeding on first run. Never overwrites existing data. */
export async function loadState(): Promise<AppState> {
  const db = await openDb();
  const stored = await new Promise<AppState | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(STATE_KEY);
    req.onsuccess = () => resolve(req.result as AppState | undefined);
    req.onerror = () => reject(req.error ?? new Error("read failed"));
  });

  if (stored) {
    // Repair any fields added after the data was first written.
    const merged: AppState = {
      ...defaultState(),
      ...stored,
      settings: { ...defaultState().settings, ...(stored.settings ?? {}) },
      groups: stored.groups ?? defaultState().groups,
    };
    merged.editingDate = logicalToday(merged.settings.dayStartHour);
    // All groups start collapsed on every reload (Q11).
    merged.collapsedGroupSlugs = merged.groups.map((g) => g.slug);
    // Ensure day-start totals are captured for today.
    return ensureDayStartTotals(merged);
  }

  const fresh = ensureDayStartTotals(defaultState());
  await saveState(fresh);
  return fresh;
}

export async function saveState(state: AppState): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(state, STATE_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("write failed"));
    tx.onabort = () => reject(tx.error ?? new Error("write aborted"));
  });
}

/** Ask the browser not to evict our data (FR-6.4). Returns the granted result. */
export async function requestPersistence(): Promise<boolean | "unsupported"> {
  if (!navigator.storage?.persist) return "unsupported";
  try {
    if (await navigator.storage.persisted?.()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  try {
    const e = await navigator.storage.estimate();
    return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
  } catch {
    return null;
  }
}

/* ---------- state helpers (pure) ---------- */

export function setEntry(state: AppState, habitSlug: string, date: string, value: number, explicit = true): AppState {
  const next: Entry = { habitSlug, date, value, explicit, updatedAt: Date.now() };
  const entries = state.entries.filter((e) => !(e.habitSlug === habitSlug && e.date === date));
  entries.push(next);
  return { ...state, entries };
}

export function upsertHabit(state: AppState, habit: Habit): AppState {
  const exists = state.habits.some((h) => h.slug === habit.slug);
  const habits = exists ? state.habits.map((h) => (h.slug === habit.slug ? habit : h)) : [...state.habits, habit];
  return { ...state, habits: habits.sort((a, b) => a.order - b.order) };
}

export function archiveHabit(state: AppState, slug: string): AppState {
  // Archive only — never a hard delete (data-loss protection).
  return { ...state, habits: state.habits.map((h) => (h.slug === slug ? { ...h, archived: true } : h)) };
}

export function upsertGoal(state: AppState, goal: Goal): AppState {
  const goals = state.goals.filter((g) => !(g.habitSlug === goal.habitSlug && g.active));
  goals.push(goal);
  return { ...state, goals };
}

export function deleteActiveGoal(state: AppState, habitSlug: string): AppState {
  return { ...state, goals: state.goals.filter((g) => g.habitSlug !== habitSlug || !g.active) };
}

export function setView(state: AppState, view: View): AppState {
  return { ...state, view };
}

export function setEditingHabit(state: AppState, slug: string | null): AppState {
  return { ...state, editingHabitSlug: slug };
}

export function setEditingGroup(state: AppState, slug: string | null): AppState {
  return { ...state, editingGroupSlug: slug };
}

export function setSettings(state: AppState, patch: Partial<Settings>): AppState {
  return { ...state, settings: { ...state.settings, ...patch } };
}



export function upsertGroup(state: AppState, group: Group): AppState {
  const exists = state.groups.some((g) => g.slug === group.slug);
  const groups = exists
    ? state.groups.map((g) => (g.slug === group.slug ? group : g))
    : [...state.groups, group];
  return { ...state, groups: groups.sort((a, b) => a.order - b.order) };
}

export function archiveGroup(state: AppState, slug: string): AppState {
  // Unassign habits from this group; never hard-delete (data-loss protection).
  const habits = state.habits.map((h) =>
    h.groupSlug === slug ? { ...h, groupSlug: null } : h
  );
  const groups = state.groups.map((g) =>
    g.slug === slug ? { ...g, archived: true } : g
  );
  return { ...state, habits, groups };
}

export function restoreGroup(state: AppState, slug: string): AppState {
  return {
    ...state,
    groups: state.groups.map((g) =>
      g.slug === slug ? { ...g, archived: false } : g
    ),
  };
}

export function moveGroup(state: AppState, slug: string, direction: "up" | "down"): AppState {
  const active = state.groups.filter((g) => !g.archived).sort((a, b) => a.order - b.order);
  const idx = active.findIndex((g) => g.slug === slug);
  if (idx === -1) return state;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= active.length) return state;

  const a = active[idx];
  const b = active[targetIdx];

  return {
    ...state,
    groups: state.groups.map((g) => {
      if (g.slug === a.slug) return { ...g, order: b.order };
      if (g.slug === b.slug) return { ...g, order: a.order };
      return g;
    }),
  };
}

export function moveHabit(state: AppState, habitSlug: string, direction: "up" | "down"): AppState {
  const active = state.habits.filter((h) => !h.archived);
  const groupSlug = active.find((h) => h.slug === habitSlug)?.groupSlug ?? null;
  const sameGroup = active.filter((h) => h.groupSlug === groupSlug).sort((a, b) => a.order - b.order);
  const idx = sameGroup.findIndex((h) => h.slug === habitSlug);
  if (idx === -1) return state;
  const targetIdx = direction === "up" ? idx - 1 : idx + 1;
  if (targetIdx < 0 || targetIdx >= sameGroup.length) return state;

  const a = sameGroup[idx];
  const b = sameGroup[targetIdx];

  return {
    ...state,
    habits: state.habits.map((h) => {
      if (h.slug === a.slug) return { ...h, order: b.order };
      if (h.slug === b.slug) return { ...h, order: a.order };
      return h;
    }),
  };
}

export function setGroupCollapsed(state: AppState, slug: string): AppState {
  const next = state.collapsedGroupSlugs.includes(slug)
    ? state.collapsedGroupSlugs.filter((s) => s !== slug)
    : [...state.collapsedGroupSlugs, slug];
  return { ...state, collapsedGroupSlugs: next };
}

export function assignHabitToGroup(state: AppState, habitSlug: string, groupSlug: string | null): AppState {
  return {
    ...state,
    habits: state.habits.map((h) =>
      h.slug === habitSlug ? { ...h, groupSlug } : h
    ),
  };
}

export function ensureDayStartTotals(state: AppState): AppState {
  const today = logicalToday(state.settings.dayStartHour);
  if (state.dayStartTotals && state.dayStartTotals.date === today) {
    return state;
  }
  // Compute totals for all habits at the start of today.
  const totals: Record<string, number> = {};
  for (const h of state.habits) {
    const goal = state.goals.find((g) => g.habitSlug === h.slug && g.active);
    if (!goal) {
      totals[h.slug] = 0;
      continue;
    }
    const scoped = state.entries.filter(
      (e) => e.habitSlug === h.slug && e.date >= goal.startDate && e.date <= goal.endDate,
    );
    totals[h.slug] = scoped.reduce((sum, e) => sum + e.value, 0);
  }
  return { ...state, dayStartTotals: { date: today, totals } };
}

export function activeHabits(state: AppState): Habit[] {
  return state.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
}
