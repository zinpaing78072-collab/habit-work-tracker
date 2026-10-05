import type { AppState } from "../types";
import { activeHabits } from "../db";
import { isLoggedOn, valueOn } from "../progress";
import { addDays, formatDayLabel, inRange, logicalToday } from "../day";
import { el, on } from "../dom";

/** History: every recorded day, kept forever (Q10/B), with a range filter. */
export function renderHistory(state: AppState, rerender: (s: AppState) => void): HTMLElement {
  const root = el("div", "view");
  const habits = activeHabits(state);
  const today = logicalToday(state.settings.dayStartHour);

  const dates = [...new Set(state.entries.map((e) => e.date))].sort().reverse();

  // The filter lives in app state so it survives re-renders (and a reload).
  const from = state.historyFrom || addDays(today, -29);
  const to = state.historyTo || today;

  root.append(sectionTitle("History", `${state.entries.length} recorded values across ${dates.length} days`));

  const filter = el("div", "filter");
  const fromInput = el("input", "dateinput") as HTMLInputElement;
  fromInput.type = "date";
  fromInput.value = from;
  fromInput.setAttribute("aria-label", "From date");
  const toInput = el("input", "dateinput") as HTMLInputElement;
  toInput.type = "date";
  toInput.value = to;
  toInput.setAttribute("aria-label", "To date");
  filter.append(labelled("From", fromInput), labelled("To", toInput));
  root.append(filter);

  const shown = dates.filter((d) => inRange(d, from, to));

  // Totals for the selected range.
  const totals = el("div", "totals");
  for (const h of habits) {
    const sum = state.entries
      .filter((e) => e.habitSlug === h.slug && inRange(e.date, from, to))
      .reduce((s, e) => s + e.value, 0);
    const cell = el("div", "total");
    cell.append(el("div", "total-n", String(sum)));
    cell.append(el("div", "total-label", h.unit ? `${h.name} (${h.unit})` : h.name));
    totals.append(cell);
  }
  root.append(el("div", "panel-title", "Totals in range"), totals);

  root.append(el("div", "panel-title", "Days"));
  if (shown.length === 0) {
    root.append(el("div", "empty", "No days in this range."));
  }

  for (const date of shown) {
    const card = el("div", "hrow");
    const left = el("div", "hrow-date");
    left.append(el("div", "hrow-main", formatDayLabel(date)));
    const count = habits.filter((h) => isLoggedOn(state, h.slug, date)).length;
    left.append(el("div", "hrow-sub", `${count} of ${habits.length} logged`));
    card.append(left);

    const vals = el("div", "hrow-vals");
    for (const h of habits) {
      const v = valueOn(state, h.slug, date);
      const logged = isLoggedOn(state, h.slug, date);
      const chip = el("div", `vchip ${v > 0 ? "vchip-on" : logged ? "vchip-zero" : "vchip-off"}`);
      chip.append(el("span", "vchip-n", h.kind === "binary" ? (v === 1 ? "✓" : "✗") : String(v)));
      chip.append(el("span", "vchip-l", h.name));
      vals.append(chip);
    }
    card.append(vals);

    const open = el("button", "btn btn-ghost btn-small", "Edit") as HTMLButtonElement;
    on(open, "click", () => rerender({ ...state, view: "today", editingDate: date }));
    card.append(open);
    root.append(card);
  }

  // Persist the filter into app state so it is not reset on the next re-render.
  on(fromInput, "change", () => rerender({ ...state, historyFrom: fromInput.value || from }));
  on(toInput, "change", () => rerender({ ...state, historyTo: toInput.value || to }));

  const reset = el("button", "btn btn-ghost btn-small", "Reset to last 30 days") as HTMLButtonElement;
  on(reset, "click", () => rerender({ ...state, historyFrom: addDays(today, -29), historyTo: today }));
  root.append(reset);

  return root;
}

export function sectionTitle(title: string, sub?: string): HTMLElement {
  const wrap = el("div", "viewtitle");
  wrap.append(el("h1", "viewtitle-h", title));
  if (sub) wrap.append(el("div", "viewtitle-sub", sub));
  return wrap;
}

export function labelled(text: string, control: HTMLElement): HTMLElement {
  const wrap = el("label", "labelled");
  wrap.append(el("span", "labelled-text", text));
  wrap.append(control);
  return wrap;
}
