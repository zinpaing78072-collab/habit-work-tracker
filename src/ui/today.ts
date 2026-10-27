import type { AppState, Group, Habit } from "../types";
import { activeHabits, setEditingGroup, setEntry, setEditingHabit, setGroupCollapsed, upsertGroup, upsertHabit } from "../db";
import { allGreenToday, isLoggedOn, loggedCount, progressFor, todayTone, valueOn } from "../progress";
import { addDays, daysBetween, formatDayLabel, formatLongDayLabel, logicalToday } from "../day";
import { el, fmtValue, on, slugify } from "../dom";
import { labelled } from "./history";

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

  /* ---- group habits ---- */
  const activeGroups = state.groups.filter((g) => !g.archived).sort((a, b) => a.order - b.order);
  const collapsed = new Set(state.collapsedGroupSlugs);

  const habitsByGroup = new Map<string, Habit[]>();
  for (const g of activeGroups) habitsByGroup.set(g.slug, []);
  const ungrouped: Habit[] = [];
  for (const h of habits) {
    if (h.groupSlug && habitsByGroup.has(h.groupSlug)) {
      habitsByGroup.get(h.groupSlug)!.push(h);
    } else {
      ungrouped.push(h);
    }
  }

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

  /* ---- group cards + habit cards ---- */
  for (const group of activeGroups) {
    const groupHabits = habitsByGroup.get(group.slug) ?? [];
    const isCollapsed = collapsed.has(group.slug);
    root.append(groupCard(state, group, groupHabits.length, isCollapsed, rerender));

    if (!isCollapsed) {
      for (const habit of groupHabits) {
        root.append(habitCard(state, habit, date, today, rerender, toast, state.editingHabitSlug === habit.slug));
      }
    }
  }

  /* ---- Ungrouped section ---- */
  if (ungrouped.length > 0) {
    root.append(groupCard(state, { slug: "", name: "Ungrouped", order: 9999, archived: false }, ungrouped.length, false, rerender));
    for (const habit of ungrouped) {
      root.append(habitCard(state, habit, date, today, rerender, toast, state.editingHabitSlug === habit.slug));
    }
  }

  /* ---- edit overlay for tapped card / group card ---- */
  if (editingHabit) {
    root.append(editingHabitOverlay(state, editingHabit, rerender, toast));
  } else if (state.editingGroupSlug) {
    const group = state.groups.find((g) => g.slug === state.editingGroupSlug);
    if (group) root.append(editingGroupOverlay(state, group, rerender, toast));
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

function groupCard(
  state: AppState,
  group: Group,
  habitCount: number,
  isCollapsed: boolean,
  rerender: (s: AppState) => void,
): HTMLElement {
  const card = el("div", `card card-group${isCollapsed ? " card-collapsed" : ""}`);
  if (group.slug) {
    on(card, "click", (ev) => {
      const target = ev.target as HTMLElement;
      if (target.tagName === "BUTTON" || target.tagName === "INPUT" || target.tagName === "SELECT") return;
      rerender(setGroupCollapsed(state, group.slug));
    });
  }

  const head = el("div", "card-head");
  const nameWrap = el("div", "card-namewrap");
  nameWrap.append(el("div", "card-name", group.name));
  nameWrap.append(el("div", "card-unit", `${habitCount} habit${habitCount !== 1 ? "s" : ""}`));
  head.append(nameWrap);

  if (group.slug) {
    const toggle = el("button", `btn btn-ghost btn-small ${isCollapsed ? "" : "collapsed-indicator"}`);
    toggle.textContent = isCollapsed ? "▸" : "▾";
    toggle.setAttribute("aria-label", isCollapsed ? `Expand ${group.name}` : `Collapse ${group.name}`);
    on(toggle, "click", (ev) => {
      ev.stopPropagation();
      rerender(setGroupCollapsed(state, group.slug));
    });
    head.append(toggle);

    const edit = el("button", "btn btn-ghost btn-small", "✎");
    edit.setAttribute("aria-label", `Edit ${group.name}`);
    on(edit, "click", (ev) => {
      ev.stopPropagation();
      rerender(setEditingGroup(state, group.slug));
    });
    head.append(edit);
  }
  card.append(head);

  return card;
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

  if (!isEditing) {
    card.append(habitBody(state, habit, date, value, logged, rerender, toast));
  }
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

  const pace = Math.ceil(progress.target / remainingDays);

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

/** Full-height overlay for editing a single habit's definition (name, unit, quick steps). */
function editingHabitOverlay(
  state: AppState,
  habit: Habit,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const overlay = el("div", "edit-overlay");
  on(overlay, "click", (ev) => {
    if (ev.target === overlay) rerender(setEditingHabit(state, null));
  });

  const panel = el("div", "edit-panel");
  panel.append(el("h2", "edit-panel-title", `Edit ${habit.name}`));

  const name = el("input", "textinput") as HTMLInputElement;
  name.type = "text";
  name.value = habit.name;
  name.setAttribute("aria-label", "Habit name");
  panel.append(labelled("Name", name));

  const groupSelect = el("select", "textinput") as HTMLSelectElement;
  groupSelect.append(el("option", null, "Ungrouped"));
  groupSelect.value = habit.groupSlug ?? "";
  for (const g of state.groups.filter((g) => !g.archived)) {
    const opt = el("option", null, g.name) as HTMLOptionElement;
    opt.value = g.slug;
    if (g.slug === habit.groupSlug) opt.selected = true;
    groupSelect.append(opt);
  }
  panel.append(labelled("Group", groupSelect));

  const unit = el("input", "textinput") as HTMLInputElement;
  unit.type = "text";
  unit.value = habit.unit;
  unit.disabled = habit.kind === "binary";
  unit.placeholder = habit.kind === "binary" ? "n/a for binary" : "e.g. min, words, pages";
  unit.setAttribute("aria-label", "Unit");
  panel.append(labelled("Unit", unit));

  const steps = el("input", "textinput") as HTMLInputElement;
  steps.type = "text";
  steps.value = habit.steps.join(",");
  steps.disabled = habit.kind === "binary";
  steps.placeholder = habit.kind === "binary" ? "n/a for binary" : "e.g. 1,5,10";
  steps.setAttribute("aria-label", "Quick steps");
  panel.append(labelled("Quick steps", steps));

  const actions = el("div", "actions");

  const save = el("button", "btn btn-primary btn-block", "Save habit") as HTMLButtonElement;
  on(save, "click", () => {
    const trimmed = name.value.trim();
    if (!trimmed) return toast("Give the habit a name");
    const nextSlug = trimmed === habit.name ? habit.slug : slugify(trimmed);
    const next: Habit = {
      slug: nextSlug,
      name: trimmed,
      kind: habit.kind,
      unit: habit.kind === "numeric" ? unit.value.trim() : "",
      steps: habit.kind === "numeric"
        ? steps.value
            .split(",")
            .map((s) => Number(s.trim()))
            .filter((x) => Number.isFinite(x) && x > 0)
            .sort((a, b) => a - b)
        : [],
      order: habit.order,
      archived: habit.archived,
      groupSlug: groupSelect.value === "" ? null : groupSelect.value,
    };
    rerender(upsertHabit(state, next));
    toast(`${next.name} saved`);
  });
  actions.append(save);

  const done = el("button", "btn btn-ghost btn-block", "Done") as HTMLButtonElement;
  on(done, "click", () => rerender(setEditingHabit(state, null)));
  actions.append(done);

  panel.append(actions);

  overlay.append(panel);
  return overlay;
}

/** Edit overlay for a group card: rename the group. Guarded against "Ungrouped" (slug ""). */
export function editingGroupOverlay(
  state: AppState,
  group: Group,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const overlay = el("div", "edit-overlay");
  on(overlay, "click", (ev) => {
    if (ev.target === overlay) rerender(setEditingGroup(state, null));
  });

  const panel = el("div", "edit-panel");
  panel.append(el("h2", "edit-panel-title", `Edit ${group.name}`));

  const name = el("input", "textinput") as HTMLInputElement;
  name.type = "text";
  name.value = group.name;
  name.setAttribute("aria-label", "Group name");
  panel.append(labelled("Group name", name));

  const actions = el("div", "actions");

  const save = el("button", "btn btn-primary btn-block", "Save group") as HTMLButtonElement;
  on(save, "click", () => {
    const trimmed = name.value.trim();
    if (!trimmed) return toast("Give the group a name");
    const next: Group = { ...group, name: trimmed };
    rerender(setEditingGroup(upsertGroup(state, next), null));
    toast(`Group "${trimmed}" saved`);
  });
  actions.append(save);

  const cancel = el("button", "btn btn-ghost btn-block", "Cancel") as HTMLButtonElement;
  on(cancel, "click", () => rerender(setEditingGroup(state, null)));
  actions.append(cancel);

  panel.append(actions);
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

