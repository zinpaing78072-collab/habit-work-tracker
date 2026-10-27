import "./styles.css";
import type { AppState, View } from "./types";
import { loadState, saveState, setView, ensureDayStartTotals } from "./db";
import { logicalToday } from "./day";
import { allGreenToday, hasUnbackedChanges } from "./progress";
import { el, on } from "./dom";
import { renderToday } from "./ui/today";
import { renderHistory } from "./ui/history";
import { renderGoals } from "./ui/goals";
import { renderSettings } from "./ui/settings";

const appEl = document.getElementById("app");
if (!appEl) throw new Error("#app missing");
const app: HTMLElement = appEl;

let state: AppState;
let toastTimer: number | undefined;

/** Persist then repaint. Every mutation flows through here. */
function update(next: AppState): void {
  state = next;
  // Auto-snapshot reminder (Q14): surfaced in Settings, not a silent background job.
  void saveState(next);
  render();
}

function toast(message: string): void {
  let node = document.getElementById("toast");
  if (!node) {
    node = el("div", "toast");
    node.id = "toast";
    node.setAttribute("role", "status");
    document.body.append(node);
  }
  node.textContent = message;
  node.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => node?.classList.remove("show"), 2200);
}

const TABS: { id: View; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "history", label: "History" },
  { id: "goals", label: "Goals" },
  { id: "settings", label: "Settings" },
];

function render(): void {
  const scrollY = window.scrollY;
  app.innerHTML = "";

  if (!state.seedNoticeDismissed) {
    const banner = el("div", "seedbanner");
    banner.append(
      el(
        "div",
        null,
        `Seeded from your notes (Sept–Oct 2026) · day starts at ${String(state.settings.dayStartHour).padStart(2, "0")}:00 · change it in Settings`,
      ),
    );
    const dismiss = el("button", "btn btn-ghost btn-small", "Got it") as HTMLButtonElement;
    on(dismiss, "click", () => update({ ...state, seedNoticeDismissed: true }));
    banner.append(dismiss);
    app.append(banner);
  }

  const main = el("main", "main");
  if (state.view === "today") main.append(renderToday(state, update, toast));
  else if (state.view === "history") main.append(renderHistory(state, update));
  else if (state.view === "goals") main.append(renderGoals(state, update, toast));
  else main.append(renderSettings(state, update, toast));
  app.append(main);

  const nav = el("nav", "tabbar");
  for (const tab of TABS) {
    const btn = el("button", `tab ${state.view === tab.id ? "is-active" : ""}`, tab.label) as HTMLButtonElement;
    btn.setAttribute("aria-current", state.view === tab.id ? "page" : "false");
    // Unbacked-changes dot (Q14/C) on Settings.
    if (tab.id === "settings" && hasUnbackedChanges(state)) {
      btn.append(el("span", "tab-dot"));
    }
    on(btn, "click", () => {
      if (state.view === tab.id) {
        // Tapping Today again returns from a past day (Q3: no date picker on Today).
        if (tab.id === "today") update({ ...state, editingDate: logicalToday(state.settings.dayStartHour) });
        return;
      }
      update(setView(state, tab.id));
    });
    nav.append(btn);
  }
  app.append(nav);

  window.scrollTo(0, Math.min(scrollY, document.body.scrollHeight));
}

/** Best-effort auto-snapshot notice (Q14/A) on next open. */
function maybeAutoSnapshotNotice(): void {
  const today = logicalToday(state.settings.dayStartHour);
  if (hasUnbackedChanges(state) && allGreenToday(state, today) && state.settings.lastExportAt === null) {
    toast("Everything green today — consider exporting a backup");
  }
}

async function boot(): Promise<void> {
  try {
    state = await loadState();
  } catch (err) {
    app.innerHTML = "";
    app.append(el("div", "fatal", `Could not open local storage: ${String(err)}`));
    return;
  }
  render();
  maybeAutoSnapshotNotice();

  // Keep "Today" honest when the app is left open past the day boundary.
  window.setInterval(() => {
    const today = logicalToday(state.settings.dayStartHour);
    if (state.view === "today" && state.editingDate !== today && !state.seedNoticeDismissed) {
      update(ensureDayStartTotals({ ...state, editingDate: today }));
    }
  }, 60_000);

  // A fresh visit always shows today.
  window.addEventListener("focus", () => {
    if (!state) return;
    const today = logicalToday(state.settings.dayStartHour);
    if (state.view === "today" && state.editingDate !== today && document.visibilityState === "visible") {
      const wasShowingToday = true;
      if (wasShowingToday) update(ensureDayStartTotals({ ...state, editingDate: today }));
    }
  });
}

void boot();
