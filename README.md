# Habit & Work Tracker

A local-only personal habit and work tracker, built for one-handed use on an iPhone X.
Installable as a PWA; **all data stays on the phone** in IndexedDB.

## What it does

- **Today screen** — one card per habit, auto-saved as you tap. Green/red reflects *today only*.
- **Missing = 0** — an unlogged day shows `0` (or Fail) without being an error.
- **Range-total goals** — every target is a total for its date range, never a per-day amount.
- **Backdating** — step back with `‹` and log any past day.
- **Day boundary** — a global "day starts at" hour (default 4 AM) so late-night entries
  still count toward the previous day. Changing it never rewrites existing history.
- **History** — every recorded day, kept forever, with a date-range filter and totals.
- **CSV backup** — one file per habit *plus* a combined `all.csv`. Validated import.
- **Custom habits** — numeric (an amount) or binary (success/fail). Archive, never delete.

## Stack

Plain **HTML + CSS + TypeScript**, bundled with **Vite**, made installable with
**vite-plugin-pwa**. No UI framework, no backend, no accounts, no analytics.
Storage is **IndexedDB** behind a small typed wrapper in `src/db.ts`, isolated from the UI.

## Run it

```bash
npm install
npm run dev        # local dev server
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build (needed for the smoke tests)
npm run typecheck  # types only
npm test           # typecheck + 59 logic checks
npm run smoke      # 3 headless-Chrome suites (~110 checks); run `npm run preview` first
```

The smoke suites drive the real built app in headless Chrome at iPhone X size
(375×812): logging, persistence across reload, backdating, goals, CSV
export/import, custom habits, archiving, and a genuine offline boot.

## Install on the iPhone

1. Open the deployed site in **Safari**.
2. **Share → Add to Home Screen**.
3. Launch it from the Home Screen. After the first load it works offline.

## Deploy to GitHub Pages

Push to `main`; `.github/workflows/pages.yml` builds and publishes automatically.
Enable **Settings → Pages → Source: GitHub Actions** in the repository first.
Only the static app shell is published — **no tracker data ever goes to GitHub**.

## Back up your data

Data lives only on the device. Clearing the website's data, deleting the Home Screen
app, or an iOS storage cleanup can erase it. Use **Settings → Export** regularly;
the Settings tab shows a red dot while there are unexported changes.

A true scheduled 1 AM automatic export is **not possible** in a home-screen iOS PWA
(no periodic background sync). The app instead prompts you when the day is fully green,
and flags unexported changes until you export.

## Notes on behaviour

| Rule | Behaviour |
|---|---|
| Editing a value | Replaces that day (no accumulation); the date is stamped automatically |
| `Logged` | Non-zero value, or explicit Success, or explicit Fail |
| Binary habits | Success = 1, Fail = 0, Not logged = 0 but shown distinctly |
| Goal progress | Sum of values inside the range; Success count for binary habits |
| Colour | Today only. Range progress uses a separate neutral bar |

## Seed data

The app starts pre-loaded with your data from the notes, combining the duplicate
handwritten lines for the same date (e.g. `22.9 = 10 + 20 = 30`). Three of the
notes' own completed totals were used to cross-check the parsing:

| Completed goal | Note says | Entries sum to |
|---|---|---|
| Meditation 22.9 → 1.10 | `332(5:32)` | **332** ✓ |
| Vocabulary 17.9 → 27.9 | `295 words` | **295** ✓ |
| Reading 25.9 → 30.9 | `5` | **5** ✓ |

**Nine habits:** Meditation, Self Remembering, Writing, Algebra Driven Design,
Retention, Fasting, Vocabulary, Reading, Bootstrap.

Completed goals are stored as locked, read-only history and shown under each
habit on the Goals screen.

### Applying an updated seed to an already-installed app

Seed data is only used on first run. If you have already opened the app, use
**Settings → Seed data → Reset to bundled seed data**. This discards all local
entries, so export first if you need them.

### Units

Units are set where the notes state one (`min`, `words`, `pages`). **Self
Remembering**, **Writing**, and **Bootstrap** have no unit stated, so they show
bare numbers. Set them in **Goals → the habit → Unit** if you want a label.

### A note on the Writing entry

The note reads `Writing 28.9 → 2.10: 100` with a single entry `3 - 11, 11`. That
entry is dated 3 October, which falls **outside** the goal's range, so Writing
currently shows `0 / 100`. The entry is preserved as written; extend the goal's
end date if the range was meant to include it.
