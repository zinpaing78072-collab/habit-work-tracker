import type { AppState, Entry, Goal, Habit, Settings, View } from "./types";
import { addDays, DEFAULT_DAY_START_HOUR, logicalToday } from "./day";
import { SEED_GOALS, SEED_HABITS, buildSeedEntries } from "./seed";

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
    historyFrom: addDays(today, -29),
    historyTo: today,
    seedNoticeDismissed: false,
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
    };
    merged.editingDate = logicalToday(merged.settings.dayStartHour);
    return merged;
  }

  const fresh = defaultState();
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

export function setSettings(state: AppState, patch: Partial<Settings>): AppState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function activeHabits(state: AppState): Habit[] {
  return state.habits.filter((h) => !h.archived).sort((a, b) => a.order - b.order);
}
