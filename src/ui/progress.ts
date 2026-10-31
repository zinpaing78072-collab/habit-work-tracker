import type { AppState, Goal, Habit } from "../types";
import { eachDay } from "../day";
import { activeGoalFor, valueOn } from "../progress";
import { el } from "../dom";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag: string): SVGElement {
  return document.createElementNS(SVG_NS, tag);
}

/** Progress screen: cumulative vs goal chart for every habit with an active goal. */
export function renderProgress(
  state: AppState,
  _rerender: (s: AppState) => void,
  _toast: (m: string) => void,
): HTMLElement {
  const root = el("div", "view");
  root.append(el("h2", null, "Progress"));
  root.append(
    el(
      "div",
      "subtitle",
      "Cumulative logged total vs goal target · active goals only",
    ),
  );

  const habitsWithGoals = state.habits
    .filter((h) => !h.archived && activeGoalFor(state, h.slug))
    .sort((a, b) => a.order - b.order);

  if (habitsWithGoals.length === 0) {
    root.append(el("div", "empty", "No active goals yet. Set one on the Goals screen to see progress here."));
    return root;
  }

  const list = el("div", "progress-list");
  for (const habit of habitsWithGoals) {
    const goal = activeGoalFor(state, habit.slug)!;
    list.append(habitProgressCard(state, habit, goal));
  }
  root.append(list);
  return root;
}

/** One habit's cumulative chart card. */
function habitProgressCard(
  state: AppState,
  habit: Habit,
  goal: Goal,
): HTMLElement {
  const card = el("div", "card progress-card");

  const dates = eachDay(goal.startDate, goal.endDate);
  const values = dates.map((d) => valueOn(state, habit.slug, d));
  let cum = 0;
  const cumulative = values.map((v) => {
    cum += v;
    return cum;
  });
  const finalCum = cumulative[cumulative.length - 1] ?? 0;
  const met = finalCum >= goal.target;

  const maxY = Math.max(goal.target, finalCum, 1);
  const chartW = 340;
  const chartH = 130;
  const padLeft = 36;
  const padBottom = 26;
  const plotH = chartH - padBottom - 8;
  const xStep = (chartW - padLeft - 10) / Math.max(dates.length - 1, 1);

  const points = cumulative.map((c, i) => {
    const x = padLeft + i * xStep;
    const y = chartH - padBottom - (c / maxY) * plotH;
    return { x, y };
  });

  const pathD = points
    .map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`))
    .join("");

  const targetY = chartH - padBottom - (goal.target / maxY) * plotH;

  const head = el("div", "progress-head");
  const nameWrap = el("div", "progress-name");
  nameWrap.append(el("div", "progress-name-text", habit.name));
  nameWrap.append(el("div", "progress-unit", `${habit.kind} · ${habit.unit || "—"}`));
  head.append(nameWrap);

  const range = el("div", "progress-range");
  range.textContent = `${goal.startDate.slice(5)} → ${goal.endDate.slice(5)}`;
  head.append(range);
  card.append(head);

  const chartWrap = el("div", "progress-chart-wrap");
  const yLabels = el("div", "progress-axis-y");
  yLabels.append(el("div", null, String(Math.round(maxY))));
  yLabels.append(el("div", null, String(Math.round(maxY / 2))));
  yLabels.append(el("div", null, "0"));

  const svg = svgEl("svg");
  svg.setAttribute("width", String(chartW));
  svg.setAttribute("height", String(chartH));
  svg.setAttribute("viewBox", `0 0 ${chartW} ${chartH}`);
  svg.setAttribute("preserveAspectRatio", "none");

  // Filled area under the line
  const areaPath = `M${padLeft},${chartH - padBottom} ${pathD} L${points[points.length - 1].x},${chartH - padBottom} Z`;
  const area = svgEl("path");
  area.setAttribute("fill", "#eff6ff");
  area.setAttribute("d", areaPath);
  svg.append(area);

  // Target line (red dashed)
  const targetLine = svgEl("line");
  targetLine.setAttribute("x1", String(padLeft));
  targetLine.setAttribute("y1", String(targetY));
  targetLine.setAttribute("x2", String(padLeft + (dates.length - 1) * xStep));
  targetLine.setAttribute("y2", String(targetY));
  targetLine.setAttribute("stroke", "#ef4444");
  targetLine.setAttribute("stroke-width", "1.5");
  targetLine.setAttribute("stroke-dasharray", "4 4");
  svg.append(targetLine);

  // Cumulative line (blue)
  const line = svgEl("path");
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "#2563eb");
  line.setAttribute("stroke-width", "2");
  line.setAttribute("d", pathD);
  svg.append(line);

  // Dots
  for (const p of points) {
    const dot = svgEl("circle");
    dot.setAttribute("cx", String(p.x));
    dot.setAttribute("cy", String(p.y));
    dot.setAttribute("r", "2.5");
    dot.setAttribute("fill", "#2563eb");
    svg.append(dot);
  }

  chartWrap.append(yLabels);
  chartWrap.append(svg);

  const xLabelsWrap = el("div", "progress-axis-x");
  dates.forEach((d, i) => {
    if (i % 7 !== 0 && i !== dates.length - 1) return;
    const label = el("div", null, d.slice(5));
    label.style.position = "absolute";
    label.style.left = `${padLeft + i * xStep}px`;
    label.style.transform = "translateX(-50%)";
    xLabelsWrap.append(label);
  });
  chartWrap.append(xLabelsWrap);

  card.append(chartWrap);

  // Summary row
  const summary = el("div", "progress-summary");
  const sum1 = el("div", "progress-sum-item");
  sum1.append(el("div", null, String(finalCum)));
  sum1.append(el("div", "progress-sum-label", habit.unit));
  summary.append(sum1);

  const sum2 = el("div", "progress-sum-item");
  sum2.append(el("div", null, String(goal.target)));
  sum2.append(el("div", "progress-sum-label", "target"));
  summary.append(sum2);
  card.append(summary);

  // Status
  const status = el("div", "progress-status");
  status.textContent = met ? "Goal met" : "On track";
  status.className = `progress-status ${met ? "met" : "behind"}`;
  card.append(status);

  return card;
}
