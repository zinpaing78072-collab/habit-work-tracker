import type { AppState, Group, Habit } from "../types";
import { activeHabits, archiveGroup, archiveHabit, assignHabitToGroup, defaultState, moveGroup, moveHabit, restoreGroup, setSettings, upsertGroup, upsertHabit } from "../db";
import { hasUnbackedChanges } from "../progress";
import { applyImport, allCsv, downloadText, habitCsv, parseHabitCsv } from "../csv";
import { el, formatBytes, formatWhen, on, slugify } from "../dom";
import { labelled, sectionTitle } from "./history";
import { SEED_GOALS, SEED_GROUPS, SEED_HABITS } from "../seed";
import { estimateStorage, requestPersistence } from "../db";

/** Settings: backup (Q14/Q25), day boundary (Q16-Q18), storage, new habits. */
export function renderSettings(
  state: AppState,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const root = el("div", "view");
  root.append(sectionTitle("Settings", "Everything is stored on this iPhone only."));

  /* ---- backup status ---- */
  const backup = el("div", "panel");
  backup.append(el("div", "panel-name", "Backup"));
  const unbacked = hasUnbackedChanges(state);
  backup.append(
    el(
      "div",
      unbacked ? "warn" : "ok",
      unbacked
        ? "There are changes that have never been exported."
        : "Everything has been exported since the last change.",
    ),
  );
  backup.append(el("div", "panel-line", `Last export: ${formatWhen(state.settings.lastExportAt)}`));

  const all = el("button", "btn btn-primary btn-block", "Export all.csv (full backup)") as HTMLButtonElement;
  on(all, "click", () => {
    downloadText("all.csv", allCsv(state));
    // Recording the export time is what clears the unbacked-changes flag (Q14/C).
    rerender(setSettings(state, { lastExportAt: Date.now() }));
    toast("Exported all.csv — save it to Files or iCloud Drive");
  });
  backup.append(all);

  backup.append(el("div", "panel-line", "Per-habit files"));
  const list = el("div", "filelist");
  // Include ARCHIVED habits: archiving must never remove data from a backup.
  // Sorted so active habits come first, archived last.
  const exportable = [...state.habits].sort((a, b) => Number(a.archived) - Number(b.archived) || a.order - b.order);
  for (const habit of exportable) {
    const row = el("div", `filerow ${habit.archived ? "filerow-archived" : ""}`);
    const label = el("div", "filename", habit.archived ? `${habit.slug}.csv (archived)` : `${habit.slug}.csv`);
    row.append(label);
    const dl = el("button", "btn btn-ghost btn-small", "Export") as HTMLButtonElement;
    on(dl, "click", () => {
      downloadText(`${habit.slug}.csv`, habitCsv(habit, state.entries));
      rerender(setSettings(state, { lastExportAt: Date.now() }));
      toast(`Exported ${habit.slug}.csv`);
    });
    const imp = el("label", "btn btn-ghost btn-small importbtn") as HTMLLabelElement;
    imp.textContent = "Import";
    const file = el("input", "hidden-file") as HTMLInputElement;
    file.type = "file";
    file.accept = ".csv,text/csv";
    on(file, "change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      const text = await f.text();
      const parsed = parseHabitCsv(text, habit.kind);
      if (!parsed.ok) {
        toast(`${habit.name}: import rejected — ${parsed.errors[0]}`);
        return;
      }
      const confirmMsg = `Replace values for ${habit.name} on ${parsed.dates.length} day(s)? Existing days not in the file are kept.`;
      if (!window.confirm(confirmMsg)) return;
      const result = applyImport(state, habit.slug, parsed.dates, parsed.values);
      rerender(result.state);
      toast(`${habit.name}: ${result.summary.added} added, ${result.summary.updated} updated`);
    });
    imp.append(file);
    row.append(dl, imp);
    list.append(row);
  }
  backup.append(list);
  root.append(backup);

  /* ---- day boundary ---- */
  const dayPanel = el("div", "panel");
  dayPanel.append(el("div", "panel-name", "Day boundary"));
  dayPanel.append(
    el("div", "panel-line", "Anything logged before this hour counts toward the previous day. Changing it affects new entries only — existing history is never rewritten."),
  );
  const hour = el("input", "textinput") as HTMLInputElement;
  hour.type = "number";
  hour.min = "0";
  hour.max = "23";
  hour.step = "1";
  hour.inputMode = "numeric";
  hour.value = String(state.settings.dayStartHour);
  hour.setAttribute("aria-label", "Day start hour");
  const saveHour = el("button", "btn btn-primary", "Save") as HTMLButtonElement;
  on(saveHour, "click", () => {
    const h = Number(hour.value);
    if (!Number.isInteger(h) || h < 0 || h > 23) return toast("Enter a whole hour between 0 and 23");
    rerender(setSettings(state, { dayStartHour: h }));
    toast(`New entries now count from ${h}:00. History is unchanged.`);
  });
  const hourRow = el("div", "inline");
  hourRow.append(hour, saveHour);
  dayPanel.append(labelled("Day starts at (0–23)", hourRow));
  root.append(dayPanel);

  /* ---- storage ---- */
  const storage = el("div", "panel");
  storage.append(el("div", "panel-name", "Storage"));
  const usageLine = el("div", "panel-line", "Checking…");
  storage.append(usageLine);
  void estimateStorage().then((est) => {
    usageLine.textContent = est
      ? `Using ${formatBytes(est.usage)} of about ${formatBytes(est.quota)} available to this site.`
      : "This browser does not report storage usage.";
  });
  storage.append(
    el("div", "warn", "Clearing this website's data, deleting the app from the Home Screen, or an iOS storage cleanup can erase your entries. Export regularly."),
  );
  const persist = el("button", "btn btn-ghost btn-block", "Request persistent storage") as HTMLButtonElement;
  on(persist, "click", async () => {
    const r = await requestPersistence();
    toast(
      r === "unsupported"
        ? "This browser does not support persistent storage"
        : r
          ? "Persistent storage granted"
          : "Persistent storage was declined — export regularly",
    );
  });
  storage.append(persist);
  storage.append(el("div", "panel-line", "Install: open in Safari, then Share → Add to Home Screen."));
  root.append(storage);

  /* ---- groups ---- */
  root.append(groupPanel(state, rerender, toast));

  /* ---- new habit ---- */
  root.append(newHabitPanel(state, rerender, toast));

  /* ---- reseed ---- */
  root.append(reseedPanel(state, rerender, toast));
  return root;
}

/**
 * Replaces local data with the bundled seed. This is the only way to apply an
 * updated seed to a device that already has stored data, so it is guarded by a
 * confirmation that states exactly what will be lost.
 */
function reseedPanel(
  state: AppState,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const panel = el("div", "panel");
  panel.append(el("div", "panel-name", "Seed data"));
  panel.append(
    el(
      "div",
      "warn",
      `Replacing local data discards all ${state.entries.length} recorded values and any habits or goals you changed. Export first if you need them.`,
    ),
  );
  const reseed = el("button", "btn btn-ghost btn-block", "Reset to bundled seed data") as HTMLButtonElement;
  on(reseed, "click", () => {
    if (!window.confirm("Replace ALL local data with the bundled seed? This cannot be undone.")) return;
    rerender(defaultState());
    toast("Local data replaced with the bundled seed");
  });
  panel.append(reseed);
  panel.append(el("div", "panel-line", `Bundled seed: ${SEED_HABITS.length} habits, ${SEED_GROUPS.length} groups, ${SEED_GOALS.length} goals.`));
  return panel;
}


/**** Groups (Q1–Q8): user-defined, one group per habit, manual reorder. ****/
function groupPanel(
  state: AppState,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const wrap = el("div", "panel");
  wrap.append(el("div", "panel-name", "Groups"));

  const activeGroups = state.groups.filter((g) => !g.archived).sort((a, b) => a.order - b.order);
  const archivedGroups = state.groups.filter((g) => g.archived);

  // ---- new group form ----
  const gname = el("input", "textinput") as HTMLInputElement;
  gname.type = "text";
  gname.placeholder = "New group name";
  gname.setAttribute("aria-label", "New group name");
  const gcreate = el("button", "btn btn-primary btn-block", "Create group") as HTMLButtonElement;
  on(gcreate, "click", () => {
    const trimmed = gname.value.trim();
    if (!trimmed) return toast("Give the group a name");
    const slug = slugify(trimmed);
    if (state.groups.some((g) => g.slug === slug)) return toast("A group with that name already exists");
    const group: Group = { slug, name: trimmed, order: state.groups.length, archived: false };
    rerender(upsertGroup(state, group));
    gname.value = "";
    toast(`Group "${trimmed}" created`);
  });
  const gform = el("div", "form");
  gform.append(labelled("Group name", gname), gcreate);
  wrap.append(gform);

  // ---- active groups ----
  if (activeGroups.length > 0) {
    wrap.append(el("div", "panel-line", "Active groups (tap a group card on Today/Goals to collapse/expand)"));
    for (const group of activeGroups) {
      const row = el("div", "filerow");
      row.append(el("div", "filename", group.name));

      const moveUp = el("button", "btn btn-ghost btn-small", "↑") as HTMLButtonElement;
      on(moveUp, "click", () => { rerender(moveGroup(state, group.slug, "up")); toast(`Moved "${group.name}" up`); });
      row.append(moveUp);

      const moveDown = el("button", "btn btn-ghost btn-small", "↓") as HTMLButtonElement;
      on(moveDown, "click", () => { rerender(moveGroup(state, group.slug, "down")); toast(`Moved "${group.name}" down`); });
      row.append(moveDown);

      const archive = el("button", "btn btn-ghost btn-small", "Archive") as HTMLButtonElement;
      on(archive, "click", () => {
        if (!window.confirm(`Archive group "${group.name}"? Its habits become ungrouped.`)) return;
        rerender(archiveGroup(state, group.slug));
        toast(`Group "${group.name}" archived`);
      });
      row.append(archive);

      // Habits in this group with reorder + group change
      const groupHabits = state.habits
        .filter((h) => !h.archived && h.groupSlug === group.slug)
        .sort((a, b) => a.order - b.order);
      if (groupHabits.length > 0) {
        const sub = el("div", "subrows");
        sub.append(el("div", "subhead", "Habits in this group"));
        for (const h of groupHabits) {
          const subrow = el("div", "filerow subrow");
          subrow.append(el("div", "filename", h.name));

          const hup = el("button", "btn btn-ghost btn-smaller", "↑") as HTMLButtonElement;
          on(hup, "click", () => { rerender(moveHabit(state, h.slug, "up")); });
          subrow.append(hup);

          const hdown = el("button", "btn btn-ghost btn-smaller", "↓") as HTMLButtonElement;
          on(hdown, "click", () => { rerender(moveHabit(state, h.slug, "down")); });
          subrow.append(hdown);

          const chooser = el("select", "textinput") as HTMLSelectElement;
          const allGroups = [{ slug: null, name: "Ungrouped" }, ...state.groups.filter((g) => !g.archived)];
          for (const g of allGroups) {
            const opt = el("option", null, g.name) as HTMLOptionElement;
            opt.value = g.slug ?? "";
            if (g.slug === h.groupSlug) opt.selected = true;
            chooser.append(opt);
          }
          on(chooser, "change", () => {
            const val = chooser.value;
            rerender(assignHabitToGroup(state, h.slug, val === "" ? null : val));
            toast(`${h.name} → ${val === "" ? "Ungrouped" : val}`);
          });
          subrow.append(chooser);

          sub.append(subrow);
        }
        wrap.append(sub);
      }

      wrap.append(row);
    }
  }

  // ---- archived groups ----
  if (archivedGroups.length > 0) {
    wrap.append(el("div", "panel-line", "Archived groups"));
    for (const group of archivedGroups) {
      const row = el("div", "filerow filerow-archived");
      row.append(el("div", "filename", group.name));
      const restore = el("button", "btn btn-ghost btn-small", "Restore") as HTMLButtonElement;
      on(restore, "click", () => {
        rerender(restoreGroup(state, group.slug));
        toast(`Group "${group.name}" restored`);
      });
      row.append(restore);
      wrap.append(row);
    }
  }

  return wrap;
}

/** Custom habits (Q24/B): numeric or binary, with a stable immutable slug. */
function newHabitPanel(
  state: AppState,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const panel = el("div", "panel");
  panel.append(el("div", "panel-name", "New habit"));

  const name = el("input", "textinput") as HTMLInputElement;
  name.type = "text";
  name.placeholder = "Habit name";
  name.setAttribute("aria-label", "Habit name");

  const kind = el("select", "textinput") as HTMLSelectElement;
  for (const [value, label] of [
    ["numeric", "Numeric (an amount per day)"],
    ["binary", "Binary (success or fail)"],
  ] as const) {
    const opt = el("option", null, label) as HTMLOptionElement;
    opt.value = value;
    kind.append(opt);
  }
  kind.setAttribute("aria-label", "Habit type");

  const unit = el("input", "textinput") as HTMLInputElement;
  unit.type = "text";
  unit.placeholder = "Unit, e.g. min";
  unit.setAttribute("aria-label", "Unit");

  const steps = el("input", "textinput") as HTMLInputElement;
  steps.type = "text";
  steps.placeholder = "Quick steps, e.g. 1,5,10";
  steps.value = "1,5,10";
  steps.setAttribute("aria-label", "Quick step sizes");

  const form = el("div", "form");
  form.append(
    labelled("Name", name),
    labelled("Type", kind),
    labelled("Unit (numeric only)", unit),
    labelled("Quick steps", steps),
  );

  const create = el("button", "btn btn-primary btn-block", "Create habit") as HTMLButtonElement;
  on(create, "click", () => {
    const trimmed = name.value.trim();
    if (!trimmed) return toast("Give the habit a name");
    let slug = slugify(trimmed);
    let n = 2;
    while (state.habits.some((h) => h.slug === slug)) slug = `${slugify(trimmed)}-${n++}`;

    const isNumeric = kind.value === "numeric";
    const parsedSteps = steps.value
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((x) => Number.isFinite(x) && x > 0)
      .sort((a, b) => a - b);

    const habit: Habit = {
      slug,
      name: trimmed,
      kind: isNumeric ? "numeric" : "binary",
      unit: isNumeric ? unit.value.trim() || "units" : "",
      steps: isNumeric ? (parsedSteps.length > 0 ? parsedSteps : [1]) : [],
      order: state.habits.length,
      archived: false,
      groupSlug: null,
    };
    rerender(upsertHabit(state, habit));
    toast(`Added ${habit.name}`);
  });

  panel.append(form, create);
  panel.append(archiveList(state, rerender, toast));
  return panel;
}

function archiveList(
  state: AppState,
  rerender: (s: AppState) => void,
  toast: (m: string) => void,
): HTMLElement {
  const wrap = el("div");
  const live = activeHabits(state);
  if (live.length > 0) {
    wrap.append(el("div", "panel-line", "Archive a habit (never deletes data)"));
    for (const h of live) {
      const row = el("div", "filerow");
      row.append(el("div", "filename", h.name));
      const btn = el("button", "btn btn-ghost btn-small", "Archive") as HTMLButtonElement;
      on(btn, "click", () => {
        if (!window.confirm(`Archive ${h.name}? Its history and CSV export are kept.`)) return;
        rerender(archiveHabit(state, h.slug));
        toast(`${h.name} archived`);
      });
      row.append(btn);
      wrap.append(row);
    }
  }

  const archived = state.habits.filter((h) => h.archived);
  if (archived.length > 0) {
    wrap.append(el("div", "panel-line", "Archived (history and exports are kept)"));
    for (const h of archived) {
      const row = el("div", "filerow");
      row.append(el("div", "filename", h.name));
      const restore = el("button", "btn btn-ghost btn-small", "Restore") as HTMLButtonElement;
      on(restore, "click", () => rerender(upsertHabit(state, { ...h, archived: false })));
      row.append(restore);
      wrap.append(row);
    }
  }
  return wrap;
}
