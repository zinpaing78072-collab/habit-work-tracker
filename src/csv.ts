import type { AppState, Entry, Habit } from "./types";
import { isValidISODate } from "./day";

/* ---------- CSV escaping ---------- */

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function row(values: (string | number)[]): string {
  return values.map(cell).join(",");
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late so iOS Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/* ---------- Export ---------- */

/** Per-habit file: date,value (Q25). */
export function habitCsv(habit: Habit, entries: Entry[]): string {
  const lines = [row(["date", "value"])];
  const rows = entries
    .filter((e) => e.habitSlug === habit.slug)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => row([e.date, e.value]));
  return [...lines, ...rows].join("\n") + "\n";
}

/** Combined day x all-habits file: the correlated view and full backup (Q25/A). */
export function allCsv(state: AppState): string {
  // Archived habits are included so a backup never silently drops their history.
  const habits = [...state.habits].sort((a, b) => a.order - b.order);
  const header = ["date", ...habits.map((h) => h.slug)];
  const byDate = new Map<string, Record<string, number>>();
  for (const e of state.entries) {
    if (habits.every((h) => h.slug !== e.habitSlug)) continue;
    const bucket = byDate.get(e.date) ?? {};
    bucket[e.habitSlug] = e.value;
    byDate.set(e.date, bucket);
  }
  const dates = [...byDate.keys()].sort();
  const lines = [row(header)];
  for (const date of dates) {
    const bucket = byDate.get(date)!;
    lines.push(row([date, ...habits.map((h) => bucket[h.slug] ?? 0)]));
  }
  return [...lines].join("\n") + "\n";
}

/* ---------- Parsing ---------- */

/** Split one CSV line honouring quoted fields. */
function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export type ParseOk = { ok: true; dates: string[]; values: number[] };
export type ParseErr = { ok: false; errors: string[] };
export type ParseResult = ParseOk | ParseErr;

/**
 * Parse a per-habit file (date,value). Validates before any write (FR-5.4).
 * `kind` matters: binary habits only accept 0 or 1, numeric accept any
 * non-negative whole number.
 */
export function parseHabitCsv(text: string, kind: Habit["kind"] = "numeric"): ParseResult {
  const errors: string[] = [];
  const dates: string[] = [];
  const values: number[] = [];

  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { ok: false, errors: ["File is empty."] };

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  if (header[0] !== "date" || header[1] !== "value") {
    return { ok: false, errors: [`Expected header "date,value" but found "${lines[0]}".`] };
  }

  lines.slice(1).forEach((line, i) => {
    const parts = splitLine(line);
    const lineNo = i + 2;
    if (parts.length < 2) {
      errors.push(`Line ${lineNo}: expected "date,value".`);
      return;
    }
    const [date, raw] = parts;
    if (!isValidISODate(date)) {
      errors.push(`Line ${lineNo}: "${date}" is not a valid YYYY-MM-DD date.`);
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) {
      errors.push(`Line ${lineNo}: "${raw}" is not a non-negative number.`);
      return;
    }
    if (!Number.isInteger(n)) {
      errors.push(`Line ${lineNo}: "${raw}" must be a whole number.`);
      return;
    }
    if (kind === "binary" && n !== 0 && n !== 1) {
      errors.push(`Line ${lineNo}: binary habits accept only 0 or 1 (found ${n}).`);
      return;
    }
    dates.push(date);
    values.push(n);
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, dates, values };
}

export type ImportSummary = { added: number; updated: number; skipped: number };

/**
 * Merge parsed values into state: matching (habit, date) pairs are REPLACED,
 * all other records are preserved (FR-5.5).
 */
export function applyImport(
  state: AppState,
  habitSlug: string,
  dates: string[],
  values: number[],
): { state: AppState; summary: ImportSummary } {
  const existing = new Set(state.entries.filter((e) => e.habitSlug === habitSlug).map((e) => e.date));
  const summary: ImportSummary = { added: 0, updated: 0, skipped: 0 };
  const now = Date.now();

  const entries = [...state.entries];
  dates.forEach((date, i) => {
    if (existing.has(date)) {
      const idx = entries.findIndex((e) => e.habitSlug === habitSlug && e.date === date);
      entries[idx] = { habitSlug, date, value: values[i], explicit: true, updatedAt: now };
      summary.updated += 1;
    } else {
      entries.push({ habitSlug, date, value: values[i], explicit: true, updatedAt: now });
      summary.added += 1;
    }
  });

  const incoming = new Set(dates);
  summary.skipped = [...existing].filter((d) => !incoming.has(d)).length;
  return { state: { ...state, entries }, summary };
}
