# Habit & Work Tracker — Design System & Screen Spec

This document is the **pencil** (design spec) for the Habit & Work Tracker. It defines the visual language, component library, and screen layouts so the app can be extended without drifting from its established look and feel.

Source of truth for implementation: `src/styles.css`, `src/ui/*.ts`, `src/types.ts`.

---

## 1. Design system

### 1.1 Tokens (CSS custom properties)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0f1115` | Page background |
| `--surface` | `#181c23` | Card / panel background |
| `--surface-2` | `#212734` | Inputs, buttons, secondary surfaces |
| `--line` | `#2b3240` | Borders, dividers |
| `--text` | `#e8ecf3` | Primary text |
| `--muted` | `#98a2b3` | Secondary / hint text |
| `--green` | `#2fbf71` | Success / logged / on-track |
| `--green-dim` | `#17351f` | Green badge background |
| `--red` | `#e5484d` | Fail / not-logged / behind |
| `--red-dim` | `#3a1c1e` | Red badge background |
| `--accent` | `#4c8dff` | Primary action, progress line, group borders |
| `--radius` | `14px` | Default corner radius |
| `--tabbar-h` | `58px` | Bottom navigation height |

### 1.2 Color rules (NFR: colour is never the only signal)

- **Green** = logged / success / on-track / met — always paired with a text label (e.g. "● Success", "On track").
- **Red** = not logged / fail / behind pace — always paired with a text label.
- **Accent (blue)** = neutral progress (goal strip, pace strip, group border) — never means "good" or "bad".
- Today screens use green/red for *today only*. Range progress (Goals, Progress screen) uses neutral accent only.

### 1.3 Typography

- System font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- Base size: `16px`, line-height `1.4`
- View titles: `24px`, letter-spacing `-0.02em`
- Card names: `17px`, font-weight `620`, letter-spacing `-0.01em`
- Small labels: `11px–12px`, uppercase, letter-spacing `0.05em–0.08em`, color `--muted`
- Numbers: `font-variant-numeric: tabular-nums` (stable widths)

### 1.4 Spacing & layout

- App container: `#app` with `padding-top: env(safe-area-inset-top)`, `min-height: 100dvh`
- Main content: `.main` max-width `640px`, centered, padding bottom accounts for tabbar + safe area
- Card padding: `12px 14px`, margin-bottom `12px`
- Panel padding: `14px`, margin-bottom `14px`
- Touch targets: minimum `44px` height for buttons, `48px` for steppers/toggles

---

## 2. Component library

### 2.1 Card (`.card`)
- Background: `--surface`, border: `1px solid --line`, radius `var(--radius)`
- Border-left: `4px solid` — color indicates state:
  - `--red` default / not-logged
  - `--green` logged today
  - `--accent` group card / progress card
- Inner: `.card-head` (name + optional unit/badge), `.card-body` (controls), optional `.goal` / `.pace` strips

### 2.2 Badge (`.badge`)
- Pill-shaped (`border-radius: 999px`), padding `3px 8px`, `font-size: 12px`, `font-weight: 600`
- `.badge-green` / `.badge-red` — color + dim background, never colour alone

### 2.3 Button (`.btn`)
- `.btn`: min-height `46px`, padding `0 16px`, `--surface-2` bg, `--line` border
- `.btn-primary`: `--accent` bg, white text
- `.btn-ghost`: transparent bg
- `.btn-block`: full width
- `.btn-small`: min-height `36px`, font-size `13px`
- `.btn-smaller`: min-width/height `32px`, font-size `14px` (settings reorder)

### 2.4 Stepper / input (`.field`, `.step`, `.input`)
- `.step`: `52×48px`, `--surface-2` bg, `--line` border, `22px` weight `600`
- `.input`: flex-1, center-aligned, `26px` weight `650`, tabular nums
- `.chips` / `.chip`: quick-step alternatives, `40px` height, `15px` weight `600`

### 2.5 Binary toggle (`.toggle`)
- `flex: 1`, min-height `48px`, `--surface-2` bg
- `.toggle-on.is-active`: `--green-dim` bg, `--green` border/text
- `.toggle-off.is-active`: `--red-dim` bg, `--red` border/text

### 2.6 Goal strip (`.goal`) — neutral
- `margin-top: 12px`, border-top `1px solid --line`
- `.goal-bar`: height `6px`, `--surface-2` bg, rounded `999px`
- `.goal-fill`: `--accent` bg; `.goal-fill-met`: `#6f7d95` (muted, never green/red)
- `.goal-meta`: flex, `12px`, `--muted`

### 2.7 Pace strip (`.pace`) — neutral
- Same neutral rules as goal strip, shows units-per-day needed

### 2.8 Tab bar (`.tabbar`, `.tab`)
- Bottom fixed nav, height `var(--tabbar-h)`
- Five tabs: Today, History, Goals, Progress, Settings
- `.tab.is-active`: `--text` color
- `.tab-dot`: red dot on Settings when unbacked changes exist

### 2.9 Edit overlay (`.edit-overlay`, `.edit-panel`)
- Backdrop blur `rgba(0,0,0,0.55)`, z-index `50`
- Panel: `--surface`, border `--line`, radius `var(--radius)`, max-width `440px`, max-height `85dvh`
- Dismiss by tapping backdrop

### 2.10 Toast (`.toast`)
- Fixed bottom, centered, pill-shaped, opacity transition, z-index `40`

### 2.11 Prompt (`.prompt`)
- `--surface` bg, `--green` border, radius `var(--radius)`, used for "all green" export nudge

---

## 3. Screens

### 3.1 Today (view `today`)
**Purpose:** Daily driver — log values for the current logical day.

**Layout:**
- Date navigator (`‹` date `›`) with "Back to today" when viewing a past day
- "N of M logged" count strip; "All green" badge + export prompt when complete
- One group card per active group (collapsible, ▸/▾ toggle + ✎ edit pencil)
- Within each expanded group: one habit card per habit, sorted by `order`
- "Ungrouped" section for habits with `groupSlug === null`
- Habit card tap opens edit overlay (name, unit, group chooser, quick steps)
- Group card click toggles collapse/expand; ✎ opens group rename overlay

**Key components:** `.datenav`, `.count`, `.card-group`, `.card`, `.badge`, `.field`/`.step`/`.input`, `.binary-row`/`.toggle`, `.goal`, `.pace`

### 3.2 History (view `history`)
**Purpose:** Every recorded day, newest first.

**Layout:**
- Date filter (From / To), defaults to last 30 days
- "Totals in range" per-habit sums
- Day rows: date, logged count, value chip per active habit, "Edit" → backdates to Today

**Key components:** `.totals`, `.day-row`, `.value-chip` (green / grey-zero / dim-not-logged, binary ✓/✗)

### 3.3 Goals (view `goals`)
**Purpose:** One active goal per habit — range-total targets.

**Layout:**
- One goal panel per active habit
- Goal strip (neutral accent bar), goal editor (Target / From / To / Unit), completed goals list
- Group cards with collapse/expand + ✎ edit pencil (same as Today)

**Key components:** `.goal`, `.goal-bar`, `.goal-fill`, `.completed`, `.completed-row`

### 3.4 Progress (view `progress`)
**Purpose:** Cumulative logged total vs goal target for every habit with an active goal.

**Layout:**
- Tab filter (This month / Last 30 days / This year)
- Empty state when no active goals: "No active goals yet. Set one on the Goals screen to see progress here."
- One progress card per habit with active goal, sorted by `order`
- Each card: habit name + kind/unit + group, goal date range, SVG cumulative chart, summary (current / target), status badge

**Chart spec (SVG, hand-drawn, no library):**
- X axis: each day in the goal's date range, weekly labels
- Y axis: 0 → half → max(target, final cumulative)
- Blue line with dots = cumulative logged total
- Red dashed line = goal target
- Filled area under the line = `--eff6ff`
- Status: "Goal met" (green) if cumulative ≥ target, else "On track" / "Behind pace"

**Key components:** `.progress-card`, `.progress-chart-wrap`, `.progress-svg`, `.progress-summary`, `.progress-status`

### 3.5 Settings (view `settings`)
**Purpose:** App configuration and data management.

**Layout (panels):**
- Backup: export status, last export time, all.csv button, per-habit Export/Import (archived included)
- Day boundary: hour picker
- Storage: persistence request, estimate
- New habit: name, type (numeric/binary), unit, quick steps → `groupSlug: null` by default
- Groups: create, archive/restore, up/down reorder, habit→group chooser per habit
- Archive list: archive live habits, restore archived
- Reseed: replace all data with bundled seed (confirmation)

**Key components:** `.panel`, `.filerow`, `.subrows`/`.subhead`/`.subrow`, `.btn-smaller`, group chooser `<select>`

---

## 4. Groups (user-defined habit grouping)

- One group per habit (`groupSlug: string | null` on `Habit`)
- `Group` type: `slug`, `name`, `order`, `archived`
- `AppState.groups: Group[]`, `AppState.collapsedGroupSlugs: string[]` (reset on reload)
- Groups render as collapsible section cards on Today + Goals only (History unaffected)
- "Ungrouped" section for `groupSlug === null` — not editable, not archivable
- CRUD + reorder in Settings: `upsertGroup`, `archiveGroup`, `restoreGroup`, `moveGroup`, `moveHabit`, `assignHabitToGroup`, `setGroupCollapsed`

---

## 5. Interaction patterns

| Gesture | Effect |
|---|---|
| Tap habit card (Today) | Open edit overlay for that habit |
| Tap group card | Toggle collapse/expand |
| Tap ✎ on group card | Open group rename overlay |
| Tap backdrop of overlay | Close overlay |
| Tap tab | Switch view; tapping Today again returns from past day |
| Tap ↑/↓ in Settings | Reorder group or habit within group |
| Tap Archive / Restore | Soft-delete / un-delete (data never hard-deleted) |

---

## 6. Files

| File | Responsibility |
|---|---|
| `src/types.ts` | `Habit`, `Group`, `Goal`, `Entry`, `AppState`, `View` |
| `src/db.ts` | IndexedDB wrapper, all state mutations (habit/group/goal/entry) |
| `src/progress.ts` | `activeGoalFor`, `valueOn`, `progressFor`, `isLoggedOn`, `todayTone` |
| `src/day.ts` | Logical-day helpers (`logicalToday`, `eachDay`, `inRange`) |
| `src/dom.ts` | `el`, `on`, `slugify`, `fmtValue` |
| `src/styles.css` | Design tokens + component CSS |
| `src/ui/today.ts` | Today screen render |
| `src/ui/history.ts` | History screen render |
| `src/ui/goals.ts` | Goals screen render |
| `src/ui/progress.ts` | Progress screen render |
| `src/ui/settings.ts` | Settings screen render |
| `src/main.ts` | App boot, tab wiring, render dispatch |
| `GLOSSARY.md` | Terminology (Group, Ungrouped, Edit overlay, etc.) |
| `docs/DESIGN.md` | This file |

---

## 7. Constraints

- No UI framework, no charting library — all charts hand-drawn SVG/CSS
- Local-only IndexedDB; nothing leaves the device unless the user exports
- PWA with service worker; works offline after first load
- iPhone X size (375×812) is the primary target; max-width `640px` on desktop
- 4-core Mac, 8 GB RAM — keep DOM light, render lazily
- Colour is never the only signal (accessibility)

---

## 8. Screen inventory

| View | Path | Status |
|---|---|---|
| Today | `src/ui/today.ts` | Implemented |
| History | `src/ui/history.ts` | Implemented |
| Goals | `src/ui/goals.ts` | Implemented |
| Progress | `src/ui/progress.ts` | Implemented |
| Settings | `src/ui/settings.ts` | Implemented |
