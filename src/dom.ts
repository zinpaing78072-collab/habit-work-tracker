import type { Habit } from "./types";

/** Tiny DOM helpers — no framework, per the agreed stack. */

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string | null,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function on<E extends Event>(
  target: EventTarget,
  type: E["type"],
  handler: (ev: E) => void,
): void {
  target.addEventListener(type, handler as EventListener);
}

/** Format a value with its habit's unit; binary habits show a word, not a number. */
export function fmtValue(n: number, habit: Habit): string {
  if (habit.kind === "binary") return n === 1 ? "Success" : "Fail";
  return habit.unit ? `${n} ${habit.unit}` : String(n);
}

/** Short form for dense places like goal bars. */
export function fmtShort(n: number, habit: Habit): string {
  if (habit.kind === "binary") return String(n);
  return String(n);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(ts: number | null): string {
  if (!ts) return "never";
  return new Date(ts).toLocaleString();
}

/** Turn arbitrary text into a stable, URL-safe, immutable slug. */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "habit";
}
