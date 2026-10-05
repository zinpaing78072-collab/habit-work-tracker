import type { AppState, Goal, Habit } from "../types";
import { activeHabits, deleteActiveGoal, upsertGoal, upsertHabit } from "../db";
import { completedGoalsFor, progressFor } from "../progress";
import { formatDayLabel, isValidISODate, todayISORange } from "../day";
import { el, on } from "../dom";
import { labelled, sectionTitle } from "./history";

/** Goals: one active goal per habit; active goals recalculate freely (Q12/D). */
export function renderGoals(state: AppState, rerender: (s: AppState) => void, toast: (m: string) => void): HTMLElement {
  const root = el("div", "view");
  root.append(sectionTitle("Goals", "Every target is a total for its date range, never a per-day amount."));

  for (const habit of activeHabits(state)) {
    root.append(goalCard(state, habit, rerender, toast));
  }

  return root;
}

function goalCard(
  state: AppState,
  habit: Habit,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const progress = progressFor(state, habit);
  const goal = progress.goal;
  const card = el("div", "panel");

  const head = el("div", "panel-head");
  head.append(el("div", "panel-name", habit.name));
  head.append(el("div", "panel-kind", habit.kind === "binary" ? "binary" : habit.unit || "numeric"));
  card.append(head);

  if (goal) {
    const bar = el("div", "goal-bar");
    const fill = el("div", "goal-fill");
    fill.style.width = `${Math.round(progress.ratio * 100)}%`;
    if (progress.met) fill.classList.add("goal-fill-met");
    bar.append(fill);
    card.append(bar);
    card.append(
      el(
        "div",
        "panel-line",
        `${progress.total} / ${progress.target}${habit.unit ? ` ${habit.unit}` : ""} · ${goal.startDate} → ${goal.endDate}`,
      ),
    );
    if (progress.expired) card.append(el("div", "panel-note", "Range ended — progress is final; set a new goal to continue."));
  } else {
    card.append(el("div", "panel-line", "No active goal."));
  }

  /* ---- editor ---- */
  const form = el("div", "form");

  const target = el("input", "textinput") as HTMLInputElement;
  target.type = "number";
  target.min = "0";
  target.step = "1";
  target.inputMode = "numeric";
  target.value = String(goal?.target ?? (habit.kind === "binary" ? 3 : 100));
  target.placeholder = "Target total";
  target.setAttribute("aria-label", `Target total for ${habit.name}`);

  const [defaultStart, defaultEnd] = todayISORange();
  const start = el("input", "textinput") as HTMLInputElement;
  start.type = "date";
  start.value = goal?.startDate ?? defaultStart;
  start.setAttribute("aria-label", `Start date for ${habit.name}`);

  const end = el("input", "textinput") as HTMLInputElement;
  end.type = "date";
  end.value = goal?.endDate ?? defaultEnd;
  end.setAttribute("aria-label", `End date for ${habit.name}`);

  form.append(labelled("Target", target));
  form.append(labelled("From", start));
  form.append(labelled("To", end));

  // Units are editable so seeded habits with an unstated unit can be fixed
  // without touching code (blank unit simply shows bare numbers).
  const unit = el("input", "textinput") as HTMLInputElement;
  unit.type = "text";
  unit.value = habit.unit;
  unit.placeholder = habit.kind === "binary" ? "n/a for binary" : "e.g. min, words, pages";
  unit.disabled = habit.kind === "binary";
  unit.setAttribute("aria-label", `Unit for ${habit.name}`);
  const saveUnit = el("button", "btn btn-primary btn-small", "Set unit") as HTMLButtonElement;
  on(saveUnit, "click", () => {
    rerender(upsertHabit(state, { ...habit, unit: unit.value.trim() }));
    toast(`${habit.name} unit set to "${unit.value.trim() || "(none)"}"`);
  });
  const unitRow = el("div", "inline");
  unitRow.append(unit, saveUnit);
  form.append(labelled("Unit", unitRow));

  const actions = el("div", "actions");
  const save = el("button", "btn btn-primary", goal ? "Update goal" : "Create goal") as HTMLButtonElement;
  on(save, "click", () => {
    const t = Number(target.value);
    if (!Number.isFinite(t) || t <= 0) return toast("Enter a target greater than 0");
    if (!isValidISODate(start.value) || !isValidISODate(end.value)) return toast("Pick valid start and end dates");
    if (end.value < start.value) return toast("The end date must not be before the start date");
    if (habit.kind === "binary" && !Number.isInteger(t)) return toast("Binary goals need a whole number of successes");

    const next: Goal = { habitSlug: habit.slug, target: Math.round(t), startDate: start.value, endDate: end.value, active: true };
    rerender(upsertGoal(state, next));
    toast(`${habit.name} goal saved: ${next.target} over ${next.startDate} → ${next.endDate}`);
  });
  actions.append(save);

  if (goal) {
    const clear = el("button", "btn btn-ghost", "Remove") as HTMLButtonElement;
    on(clear, "click", () => {
      rerender(deleteActiveGoal(state, habit.slug));
      toast(`${habit.name} goal removed — your history is kept`);
    });
    actions.append(clear);
  }

  form.append(actions);
  card.append(form);

  // Completed goals: read-only history for this habit (never editable — Q12/D).
  const done = completedGoalsFor(state, habit.slug);
  if (done.length > 0) {
    const list = el("div", "completed");
    list.append(el("div", "panel-line", "Completed"));
    for (const g of done) {
      const row = el("div", "completed-row");
      row.append(el("span", "completed-tick", "✓"));
      const achieved = g.result ?? progressInRange(state, habit, g.startDate, g.endDate);
      const met = achieved >= g.target;
      row.append(
        el(
          "span",
          "completed-text",
          `${formatDayLabel(g.startDate)} → ${formatDayLabel(g.endDate)} · ${achieved} / ${g.target}${habit.unit ? ` ${habit.unit}` : ""}${met ? "" : " (short)"}`,
        ),
      );
      list.append(row);
    }
    card.append(list);
  }

  return card;
}

/** Progress for a specific (possibly closed) range. */
function progressInRange(state: AppState, habit: Habit, startDate: string, endDate: string): number {
  return state.entries
    .filter((e) => e.habitSlug === habit.slug && e.date >= startDate && e.date <= endDate)
    .reduce((sum, e) => sum + e.value, 0);
}
