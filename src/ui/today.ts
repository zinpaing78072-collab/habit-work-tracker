import type { AppState, Habit } from "../types";
import { activeHabits, setEntry, setEditingHabit } from "../db";
import { allGreenToday, isLoggedOn, loggedCount, progressFor, todayTone, valueOn } from "../progress";
import { addDays, daysBetween, formatDayLabel, formatLongDayLabel, logicalToday } from "../day";
import { el, fmtValue, on } from "../dom";

/** Today screen: the daily driver (Q1/Q2/Q3/Q9/Q20/Q21/Q22). */
export function renderToday(state: AppState, rerender: (s: AppState) => void, toast: (m: string) => void): HTMLElement {
  const root = el("div", "view");
  const today = logicalToday(state.settings.dayStartHour);
  const date = state.editingDate || today;
  const isToday = date === today;
  const habits = activeHabits(state);
  const logged = loggedCount(state, date, habits);
  const done = allGreenToday(state, date);
  const editingHabit = state.editingHabitSlug ? habits.find((h) => h.slug === state.editingHabitSlug) : undefined;

  /* ---- date navigation, enabling backdating (Q4/B) ---- */
  const nav = el("div", "datenav");
  const prev = el("button", "navbtn", "‹") as HTMLButtonElement;
  prev.setAttribute("aria-label", "Previous day");
  on(prev, "click", () => rerender(setEditingHabit({ ...state, editingDate: addDays(date, -1) }, null)));

  const label = el("div", "navlabel");
  label.append(el("div", "navlabel-main", isToday ? "Today" : formatDayLabel(date)));
  label.append(el("div", "navlabel-sub", formatLongDayLabel(date)));
  if (!isToday) label.append(el("div", "navlabel-sub", "editing a past day"));

  const next = el("button", "navbtn", "›") as HTMLButtonElement;
  next.setAttribute("aria-label", "Next day");
  next.disabled = date >= today;
  on(next, "click", () => {
    const d = addDays(date, 1);
    if (d <= today) rerender(setEditingHabit({ ...state, editingDate: d }, null));
  });

  nav.append(prev, label, next);
  root.append(nav);

  if (!isToday) {
    const back = el("button", "btn btn-ghost btn-block", "Back to today") as HTMLButtonElement;
    on(back, "click", () => rerender(setEditingHabit({ ...state, editingDate: today }, null)));
    root.append(back);
  }

  /* ---- N of M logged (Q21/C, Q22/A) ---- */
  const count = el("div", done ? "count count-done" : "count");
  count.append(el("strong", null, `${logged} of ${habits.length} logged`));
  if (done) count.append(el("span", "count-badge", "All green — good moment to back up"));
  root.append(count);

  for (const habit of habits) root.append(habitCard(state, habit, date, today, rerender, toast, state.editingHabitSlug === habit.slug));

  /* ---- edit overlay for tapped card ---- */
  if (editingHabit) {
    root.append(editingHabitOverlay(state, editingHabit, date, rerender, toast));
  }

  /* ---- all-green export prompt (Q14) ---- */
  if (done && state.settings.lastExportAt === null) {
    const prompt = el("div", "prompt");
    prompt.append(el("div", "prompt-title", "Everything is green today"));
    prompt.append(el("div", "prompt-body", "Export a CSV backup now so this day cannot be lost."));
    const go = el("button", "btn btn-primary btn-block", "Export backup") as HTMLButtonElement;
    on(go, "click", () => rerender({ ...state, view: "settings" }));
    prompt.append(go);
    root.append(prompt);
  }

  return root;
}

function habitCard(
  state: AppState,
  habit: Habit,
  date: string,
  today: string,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
  isEditing = false,
): HTMLElement {
  const tone = todayTone(state, habit, date);
  const value = valueOn(state, habit.slug, date);
  const logged = isLoggedOn(state, habit.slug, date);
  const progress = progressFor(state, habit);

  const card = el("div", `card card-${tone}${isEditing ? " card-editing" : ""}`);
  on(card, "click", (ev) => {
    const target = ev.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "SELECT") return;
    rerender(setEditingHabit(state, habit.slug));
  });

  const head = el("div", "card-head");
  const nameWrap = el("div", "card-namewrap");
  nameWrap.append(el("div", "card-name", habit.name));
  if (habit.kind === "numeric" && habit.unit) nameWrap.append(el("div", "card-unit", habit.unit));
  head.append(nameWrap);

  // Colour is never the only signal (NFR): a text label accompanies it.
  // Numeric explicit 0 IS logged (counted in "N of M") — say so, don't claim
  // "Not logged"; a genuinely absent day still says "Not logged".
  const badge = el("div", `badge badge-${tone}`);
  badge.textContent =
    habit.kind === "binary"
      ? `${tone === "green" ? "●" : "○"} ${value === 1 ? "Success" : logged ? "Fail" : "Not logged"}`
      : `${tone === "green" ? "●" : "○"} ${tone === "green" ? "Logged" : logged ? "Logged 0" : "Not logged"}`;
  head.append(badge);
  card.append(head);

  card.append(habitBody(state, habit, date, value, logged, rerender, toast));
  card.append(goalStrip(habit, progress));

  const pace = paceStrip(habit, progress, today);
  if (pace) card.append(pace);
  return card;
}

/** Pace strip: units per day needed from today to reach the goal by end date.
 *  Hidden when there is no active goal, the goal is expired/met, or no days remain.
 *  Neutral styling — never reuses today's green/red accent. */
function paceStrip(
  habit: Habit,
  progress: ReturnType<typeof progressFor>,
  today: string,
): HTMLElement | null {
  if (!progress.hasGoal || progress.expired || progress.remaining <= 0) return null;
  if (habit.kind !== "numeric") return null;

  const remainingDays = daysBetween(today, progress.goal!.endDate) + 1;
  if (remainingDays <= 0) return null;

  const pace = Math.ceil(progress.remaining / remainingDays);

  const g = el("div", "pace");
  g.append(el("span", null, "Pace:"));
  g.append(el("strong", "pace-n", String(pace)));
  g.append(el("span", null, `${habit.unit}/day`));
  return g;
}

function habitBody(
  state: AppState,
  habit: Habit,
  date: string,
  value: number,
  logged: boolean,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const body = el("div", "card-body");

  if (habit.kind === "binary") {
    const row = el("div", "binary-row");
    const success = el("button", `toggle toggle-on ${value === 1 ? "is-active" : ""}`, "Success") as HTMLButtonElement;
    success.setAttribute("aria-pressed", String(value === 1));
    on(success, "click", () => {
      const next = value === 1 ? 0 : 1;
      rerender(setEntry(state, habit.slug, date, next));
      toast(`${habit.name}: ${next === 1 ? "Success" : "Fail"}`);
    });

    const fail = el("button", `toggle toggle-off ${value === 0 && logged ? "is-active" : ""}`, "Fail") as HTMLButtonElement;
    fail.setAttribute("aria-pressed", String(value === 0 && logged));
    on(fail, "click", () => {
      const next = value === 0 && logged ? 1 : 0;
      rerender(setEntry(state, habit.slug, date, next));
      toast(`${habit.name}: ${next === 1 ? "Success" : "Fail"}`);
    });

    row.append(success, fail);
    body.append(row);
    if (!logged) body.append(el("div", "hint", "Not logged — counts as 0 toward the goal"));
    return body;
  }

  // Numeric: keypad typing AND steppers (Q20/D).
  const biggest = habit.steps[habit.steps.length - 1] ?? 1;
  const field = el("div", "field");

  const minus = el("button", "step", "−") as HTMLButtonElement;
  minus.setAttribute("aria-label", `Decrease ${habit.name}`);
  on(minus, "click", () => {
    const next = Math.max(0, value - biggest);
    rerender(setEntry(state, habit.slug, date, next));
    toast(`${habit.name}: ${fmtValue(next, habit)}`);
  });

  const input = el("input", "input") as HTMLInputElement;
  input.type = "number";
  input.inputMode = "numeric";
  input.min = "0";
  input.step = "1";
  input.value = String(value);
  input.setAttribute("aria-label", `${habit.name} value for this day`);
  on(input, "change", () => {
    const n = Number(input.value);
    if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
      input.value = String(value);
      toast("Enter a whole number of 0 or more");
      return;
    }
    rerender(setEntry(state, habit.slug, date, n));
    toast(`${habit.name} saved: ${n}`);
  });

  const plus = el("button", "step", "+") as HTMLButtonElement;
  plus.setAttribute("aria-label", `Increase ${habit.name}`);
  on(plus, "click", () => {
    const next = value + biggest;
    rerender(setEntry(state, habit.slug, date, next));
    toast(`${habit.name}: ${fmtValue(next, habit)}`);
  });

  field.append(minus, input, plus);
  body.append(field);

  if (habit.steps.length > 0) {
    const chips = el("div", "chips");
    for (const step of habit.steps) {
      const chip = el("button", "chip", `+${step}`) as HTMLButtonElement;
      chip.setAttribute("aria-label", `Add ${step} to ${habit.name}`);
      on(chip, "click", () => {
        const next = value + step;
        rerender(setEntry(state, habit.slug, date, next));
        toast(`${habit.name}: ${fmtValue(next, habit)}`);
      });
      chips.append(chip);
    }
    body.append(chips);
  }

  return body;
}

/** Full-height overlay for editing a single habit's entry on a given day. */
function editingHabitOverlay(
  state: AppState,
  habit: Habit,
  date: string,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const tone = todayTone(state, habit, date);
  const value = valueOn(state, habit.slug, date);
  const logged = isLoggedOn(state, habit.slug, date);

  const overlay = el("div", "edit-overlay");
  on(overlay, "click", (ev) => {
    if (ev.target === overlay) rerender(setEditingHabit(state, null));
  });

  const panel = el("div", "edit-panel");
  panel.append(el("h2", "edit-panel-title", habit.name));
  if (habit.kind === "numeric" && habit.unit) {
    panel.append(el("div", "edit-panel-unit", habit.unit));
  }

  const badge = el("div", `badge badge-${tone}`);
  badge.textContent =
    habit.kind === "binary"
      ? `${tone === "green" ? "●" : "○"} ${value === 1 ? "Success" : logged ? "Fail" : "Not logged"}`
      : `${tone === "green" ? "●" : "○"} ${tone === "green" ? "Logged" : "Not logged"}`;
  panel.append(badge);

  panel.append(habitBody(state, habit, date, value, logged, rerender, toast));

  const done = el("button", "btn btn-primary btn-block", "Done") as HTMLButtonElement;
  on(done, "click", () => rerender(setEditingHabit(state, null)));
  panel.append(done);

  overlay.append(panel);
  return overlay;
}

/** Neutral progress strip (Q9/C): never reuses the today green/red accent. */
function goalStrip(habit: Habit, progress: ReturnType<typeof progressFor>): HTMLElement {
  const g = el("div", "goal");
  if (!progress.hasGoal) {
    g.classList.add("goal-none");
    g.textContent = "No active goal";
    return g;
  }

  const bar = el("div", "goal-bar");
  const fill = el("div", "goal-fill");
  fill.style.width = `${Math.round(progress.ratio * 100)}%`;
  if (progress.met) fill.classList.add("goal-fill-met");
  bar.append(fill);

  const meta = el("div", "goal-meta");
  meta.append(el("span", "goal-count", `${progress.total} / ${progress.target}${habit.unit ? ` ${habit.unit}` : ""}`));
  meta.append(el("span", "goal-range", `${progress.goal!.startDate} → ${progress.goal!.endDate}`));

  g.append(bar, meta);
  if (progress.expired) g.append(el("div", "goal-note", "range ended — set a new goal"));
  return g;
}

