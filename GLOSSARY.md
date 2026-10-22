# Habit & Work Tracker

A local-only personal record of daily habits measured against range-total goals. This glossary covers what gets logged on which day, how logged values add up over a range, and the names of the screens and components that show them.

## Habits

**Habit**:
A tracked behaviour, either numeric (an amount) or binary (success/fail).
_Avoid_: metric, task, streak, item

**Numeric habit**:
A habit measured as a whole-number amount, with an optional display unit such as `min`, `words`, or `pages`.
_Avoid_: counter

**Binary habit**:
A habit whose every day is one of two deliberate outcomes: Success or Fail.
_Avoid_: boolean habit, checkbox habit, yes/no habit

**Archive**:
Retiring a habit from daily tracking while everything it recorded is kept forever.
_Avoid_: delete, remove, deactivate, hide

## Days and entries

**Logical day**:
A calendar date as this app counts it — it begins at the day-boundary hour, not at midnight.
_Avoid_: calendar day, timestamp

**Day boundary**:
The global hour (default 4 AM) that decides where every logical day begins.
_Avoid_: midnight, timezone, cutoff

**Entry**:
One recorded value for one habit on one logical day.
_Avoid_: data point, session, observation

**Logged**:
A habit-day holding a deliberate record: a non-zero value, an explicit zero, or a Fail. An absent habit-day is never logged.
_Avoid_: done, completed, checked

**Not logged**:
A habit-day with no entry at all; it counts as zero without being an error.
_Avoid_: missing, missed, skipped, failed

**Success**:
A binary habit-day deliberately recorded as achieved.
_Avoid_: pass, done, green

**Fail**:
A binary habit-day deliberately recorded as not achieved; unlike a day that is not logged, a Fail is a logged outcome.
_Avoid_: miss, zero, red, not logged

**Backdating**:
Editing a past logical day instead of the current one.
_Avoid_: correcting, rescheduling, fixing history

**All green**:
A day on which every active habit holds a non-zero logged value; a logged Fail or an explicit 0 deliberately blocks it.
_Avoid_: all logged, complete, done, perfect day

## Goals

**Goal**:
A target total for one habit over an inclusive date range — never a per-day amount.
_Avoid_: daily goal, per-day quota, milestone

**Active goal**:
The one goal currently in effect for a habit; at most one exists per habit at a time.
_Avoid_: open goal, live goal

**Expired goal**:
A goal whose date range has passed while still active — it keeps recalculating and stays editable until replaced or removed.
_Avoid_: completed goal, finished goal, ended goal

**Completed goal**:
A deliberately locked record of a goal, kept as read-only history under its habit; created explicitly, never merely because a date range passed.
_Avoid_: expired goal, archived goal, past goal

## Backup and data

**Export**:
A CSV file of recorded entries downloaded to the device — the app's only backup mechanism.
_Avoid_: sync, upload, cloud backup, autosave

**Unexported changes**:
Entry changes made after the last export.
_Avoid_: unsaved changes, unbacked changes, pending sync

**Seed data**:
The real habit, goal, and entry history the app starts with, transcribed from the owner's handwritten notes.
_Avoid_: demo data, sample data, fixtures, test data

## Screens

**Today screen**:
The daily driver: one Habit card per Active habit for the edited Logical day, with the Date navigator, the Logged count, and — before the first export — the Export prompt.
_Avoid_: home, dashboard, main screen

**History screen**:
Every recorded day, newest first, with the Date filter, Totals in range, and a Day row per day.
_Avoid_: log, calendar, archive

**Goals screen**:
One Goal panel per Active habit — progress, the Goal editor, and the Completed list.
_Avoid_: targets screen, progress screen

**Settings screen**:
Backup, Day boundary, storage, new habits, and Reseed — everything about the app rather than about the habits.
_Avoid_: config, preferences, admin

## Today components

**Habit card**:
One card per Active habit on the Today screen: name and unit, Status badge, the habit's input controls, and its Goal strip. Its green/red tone reflects the displayed day only.
_Avoid_: metric card, habit tile, widget

**Status badge**:
The ●/○ label beside a habit's name — Logged, Logged 0 (a deliberate numeric zero), Not logged, Success, or Fail — so colour is never the only signal.
_Avoid_: tag, chip, pill

**Date navigator**:
The ‹ date › row atop the Today screen; the only route to Backdating, since there is no date picker. "Back to today" appears while a past day is shown.
_Avoid_: date picker, calendar, date selector

**Logged count**:
The "N of M logged" line — on the Today screen for the displayed day, in each History Day row for that day; on Today it carries an extra badge once the day is All green.
_Avoid_: score, streak counter, progress header

**Stepper**:
The − / + buttons flanking a numeric input; each tap moves the value by the habit's largest Quick step.
_Avoid_: spinner, increment buttons

**Quick-step chip**:
One of the +N buttons under a numeric input, one per Quick step of the habit.
_Avoid_: preset, shortcut, stepper

**Success/Fail toggle**:
The button pair replacing the numeric input on a Binary habit; pressing one records that outcome for the day, and a hint marks a Not logged day.
_Avoid_: switch, checkbox, radio

**Goal strip**:
The neutral range-progress element on a Habit card or Goal panel — bar plus total/target and dates — which never reuses the green/red today tone.
_Avoid_: neutral bar, progress strip, today bar

**Export prompt**:
The green-bordered card on the Today screen shown while a day is All green and nothing has been exported yet, offering a jump to Settings.
_Avoid_: modal, popup, auto-backup reminder

## History components

**Date filter**:
The From/To pair on the History screen; defaults to the last 30 days and persists across reloads.
_Avoid_: date range picker, search, query

**Totals in range**:
The per-habit sums shown above the day list for the current filter range.
_Avoid_: stats, summary, aggregate

**Day row**:
One History row per recorded day: the date, its Logged count, a Value chip per Active habit, and Edit — which opens that day on the Today screen for Backdating.
_Avoid_: entry, log line, timeline item

**Value chip**:
A single habit's cell in a Day row: green when non-zero, muted grey when logged as zero, dim grey when not logged; Binary habits show ✓/✗.
_Avoid_: badge, tag, pill

## Goals components

**Goal panel**:
The Goals-screen section for one habit: its Goal strip summary, the Goal editor, and the Completed list.
_Avoid_: habit card, goal card, metric panel

**Goal editor**:
The Target / From / To / Unit fields under a Goal strip; saving replaces the habit's Active goal.
_Avoid_: goal settings, target form

**Completed list**:
The ✓ rows beneath a Goal editor listing each Completed goal with achieved/target and a "(short)" marker when the target was missed.
_Avoid_: goal history, past goals, trophy case

## Settings components

**Backup panel**:
The Settings section with export status, last export time, the all.csv button, and per-habit Export/Import rows — Archived habits included, listed last.
_Avoid_: sync panel, export page, restore centre

**New habit panel**:
The Settings form creating a custom habit — name, type, unit, Quick steps — under an immutable slug derived from the name.
_Avoid_: habit wizard, add screen, create modal

**Archive list**:
The Settings rows for archiving a live habit or restoring an Archived one; archiving never deletes data.
_Avoid_: delete list, trash, recycle bin

**Reseed**:
The Settings action replacing ALL local data with the bundled Seed data, behind a confirmation; the only way to apply an updated seed.
_Avoid_: restore, import, factory reset

## Shell

**Tab bar**:
The four-tab bottom navigation — Today, History, Goals, Settings — with a red dot on Settings while Unexported changes exist; tapping Today while on Today returns from a past day.
_Avoid_: nav bar, menu, footer

**Toast**:
The transient confirmation after a saved action; the app's only ambient feedback.
_Avoid_: snackbar, notification, popup

**Seed banner**:
The first-run strip naming the seeded period and the Day boundary, dismissed with "Got it".
_Avoid_: onboarding banner, header, alert
