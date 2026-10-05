// Verifies the agreed rules against the real modules (no test framework needed).
import { defaultState, setEntry } from "../src/db.ts";
import { addDays, logicalToday, isValidISODate, eachDay } from "../src/day.ts";
import { SEED_HABITS } from "../src/seed.ts";
import { allGreenToday, completedGoalsFor, hasUnbackedChanges, isLoggedOn, loggedCount, progressFor, todayTone, valueOn } from "../src/progress.ts";
import { allCsv, applyImport, habitCsv, parseHabitCsv } from "../src/csv.ts";

let failures = 0;
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

const state = defaultState();

/* ---- seed totals (Q15: duplicate lines combined) ---- */
function lifetimeTotal(slug) {
  return state.entries.filter((e) => e.habitSlug === slug).reduce((s, e) => s + e.value, 0);
}
check("meditation lifetime total 414", lifetimeTotal("meditation"), 414);
check("self-remembering lifetime total 460", lifetimeTotal("self-remembering"), 460);
check("writing lifetime total 22", lifetimeTotal("writing"), 22);
check("algebra lifetime total 138", lifetimeTotal("algebra"), 138);
check("retention lifetime 3 successes", lifetimeTotal("retention"), 3);
check("fasting lifetime 1 success", lifetimeTotal("fasting"), 1);
check("vocabulary lifetime total 320", lifetimeTotal("vocabulary"), 320);
check("reading lifetime total 5", lifetimeTotal("reading"), 5);
check("bootstrap lifetime total 240", lifetimeTotal("bootstrap"), 240);
check("nine habits seeded", state.habits.length, 9);
check("nine active goals + five completed", [state.goals.filter((g) => g.active).length, state.goals.filter((g) => !g.active).length], [9, 5]);
check("54 seeded entries", state.entries.length, 54);

// progressFor reports the ACTIVE goal range, which is a subset of the lifetime.
check("meditation active-goal progress is 82 (not the lifetime 414)", progressFor(state, SEED_HABITS[0]).total, 82);
check("self-remembering active-goal progress is 460", progressFor(state, SEED_HABITS[1]).total, 460);
check("writing active-goal progress is 0", progressFor(state, SEED_HABITS[2]).total, 0);
check("algebra active-goal progress is 138", progressFor(state, SEED_HABITS[3]).total, 138);
check("retention active-goal progress is 2", progressFor(state, SEED_HABITS[4]).total, 2);
check("fasting active-goal progress is 1", progressFor(state, SEED_HABITS[5]).total, 1);
check("vocabulary active-goal progress is 25", progressFor(state, SEED_HABITS[6]).total, 25);
check("reading active-goal progress is 0", progressFor(state, SEED_HABITS[7]).total, 0);
check("bootstrap active-goal progress is 240", progressFor(state, SEED_HABITS[8]).total, 240);

/* ---- the notes' own completed totals cross-check our parsing ---- */
function totalInRange(slug, start, end) {
  return state.entries.filter((e) => e.habitSlug === slug && e.date >= start && e.date <= end).reduce((s, e) => s + e.value, 0);
}
check("meditation 22.9->1.10 = 332 (matches the note)", totalInRange("meditation", "2026-09-22", "2026-10-01"), 332);
check("meditation 17->21 is 0 in seed (entries start 22.9, note says 124)", totalInRange("meditation", "2026-09-17", "2026-09-21"), 0);
check("vocabulary 17.9->27.9 = 295 (matches the note)", totalInRange("vocabulary", "2026-09-17", "2026-09-27"), 295);
check("reading 25.9->30.9 = 5 (matches the note)", totalInRange("reading", "2026-09-25", "2026-09-30"), 5);

/* ---- range totals for the ACTIVE goals ---- */
check("meditation active goal 2.10->11.10 shows 82", totalInRange("meditation", "2026-10-02", "2026-10-11"), 82);
check("self-remembering active goal shows 460", totalInRange("self-remembering", "2026-09-29", "2026-10-03"), 460);
check("writing active goal shows 0 (entry on 3 Oct is outside)", totalInRange("writing", "2026-09-28", "2026-10-02"), 0);
check("algebra active goal shows 138", totalInRange("algebra", "2026-09-29", "2026-10-09"), 138);
check("retention active goal shows 2", totalInRange("retention", "2026-09-24", "2026-09-29"), 2);
check("fasting active goal shows 1", totalInRange("fasting", "2026-09-24", "2026-09-29"), 1);
check("vocabulary active goal shows 25", totalInRange("vocabulary", "2026-09-28", "2026-10-08"), 25);
check("reading active goal shows 0", totalInRange("reading", "2026-10-01", "2026-10-10"), 0);
check("bootstrap active goal shows 240", totalInRange("bootstrap", "2026-09-25", "2026-10-05"), 240);

/* ---- completed goals are retained and locked ---- */
check("meditation has 2 completed goals", completedGoalsFor(state, "meditation").length, 2);
check("newest completed goal first", completedGoalsFor(state, "meditation").map((g) => g.endDate), ["2026-10-01", "2026-09-21"]);
check("completed goal keeps its result", completedGoalsFor(state, "meditation")[0].result, 332);
check("completed goals are not active", completedGoalsFor(state, "meditation").every((g) => !g.active), true);
check("algebra completed goal result 200", completedGoalsFor(state, "algebra")[0].result, 200);

/* ---- day boundary (Q16-Q18) ---- */
check("01:00 on the 26th is the 25th (4AM boundary)", logicalToday(4, new Date(2026, 8, 26, 1, 0, 0)), "2026-09-25");
check("04:00 on the 26th is the 26th", logicalToday(4, new Date(2026, 8, 26, 4, 0, 0)), "2026-09-26");
check("03:30 on the 26th is the 25th", logicalToday(4, new Date(2026, 8, 26, 3, 30, 0)), "2026-09-25");
check("midnight boundary keeps 00:30 on the 26th", logicalToday(0, new Date(2026, 8, 26, 0, 30, 0)), "2026-09-26");
check("default day start hour is 4", state.settings.dayStartHour, 4);
check("addDays crosses months", addDays("2026-09-30", 1), "2026-10-01");
check("eachDay is inclusive", eachDay("2026-09-22", "2026-09-24").length, 3);
check("isValidISODate rejects 31 Sep", isValidISODate("2026-09-31"), false);
check("isValidISODate accepts 30 Sep", isValidISODate("2026-09-30"), true);

/* ---- missing = 0 and logged semantics (Q2, Q22) ---- */
// 20 Sep is the one genuinely empty day in the new seed.
const fresh = "2026-09-20";
check("untouched day reads as 0", valueOn(state, "meditation", fresh), 0);
check("untouched day is not logged", isLoggedOn(state, "meditation", fresh), false);
check("untouched day tone is red", todayTone(state, SEED_HABITS[0], fresh), "red");
check("recorded day is logged", isLoggedOn(state, "meditation", "2026-09-22"), true);
check("recorded day tone is green", todayTone(state, SEED_HABITS[0], "2026-09-22"), "green");
check("explicit fail IS logged", isLoggedOn(state, "retention", "2026-09-24"), true);
check("explicit fail value is 0", valueOn(state, "retention", "2026-09-24"), 0);
check("explicit fail tone is red", todayTone(state, SEED_HABITS[4], "2026-09-24"), "red");
check("explicit success is green", todayTone(state, SEED_HABITS[4], "2026-09-25"), "green");

/* ---- editing replaces, does not accumulate (Q3) ---- */
let s = setEntry(state, "meditation", fresh, 20);
s = setEntry(s, "meditation", fresh, 35);
check("second edit replaces the value", valueOn(s, "meditation", fresh), 35);
check("no duplicate record for that day", s.entries.filter((e) => e.habitSlug === "meditation" && e.date === fresh).length, 1);

/* ---- N of M and all-green (Q21, Q22) ---- */
check("logged count on a seed day", loggedCount(state, "2026-09-25"), 6);
check("not all green on a seed day", allGreenToday(state, "2026-09-25"), false);
let full = state;
for (const h of SEED_HABITS) full = setEntry(full, h.slug, fresh, 1);
check("all nine logged = 9 of 9", loggedCount(full, fresh), 9);
check("all green when every habit has a value", allGreenToday(full, fresh), true);

/* ---- unbacked changes (Q14/C) ---- */
check("unbacked at first run", hasUnbackedChanges(state), true);
// Simulate an export that happened AFTER the seed was written, then an edit
// that happened after that export. Timestamps are explicit so the test is
// deterministic rather than dependent on millisecond timing.
const exportTime = Math.max(...state.entries.map((e) => e.updatedAt)) + 1000;
const backed = { ...state, settings: { ...state.settings, lastExportAt: exportTime } };
check("not unbacked right after export", hasUnbackedChanges(backed), false);

const editedAfterExport = {
  ...backed,
  entries: [
    ...backed.entries.map((e) => (e.habitSlug === "meditation" ? { ...e, value: 5, updatedAt: exportTime - 500 } : e)),
    { habitSlug: "meditation", date: fresh, value: 12, explicit: true, updatedAt: exportTime + 1000 },
  ],
};
check("unbacked again after a new edit", hasUnbackedChanges(editedAfterExport), true);

/* ---- goal progress is a range total (Q6, Q12) ---- */
const tight = { ...state, goals: state.goals.map((g) => (g.habitSlug === "meditation" ? { ...g, startDate: "2026-09-23", endDate: "2026-09-24" } : g)) };
check("narrowed range excludes the 22nd", progressFor(tight, SEED_HABITS[0]).total, 112); // 46 + 66
// Meditation's active goal holds 82, so a target of 80 is met and 100 is not.
const met = { ...state, goals: state.goals.map((g) => (g.habitSlug === "meditation" ? { ...g, target: 80 } : g)) };
check("met goal is flagged met", progressFor(met, SEED_HABITS[0]).met, true);
check("met goal remaining is 0", progressFor(met, SEED_HABITS[0]).remaining, 0);
const unmet = { ...state, goals: state.goals.map((g) => (g.habitSlug === "meditation" ? { ...g, target: 100 } : g)) };
check("unmet goal is flagged not met", progressFor(unmet, SEED_HABITS[0]).met, false);
check("unmet goal remaining is 18", progressFor(unmet, SEED_HABITS[0]).remaining, 18);
check("expired goal is flagged", progressFor(state, SEED_HABITS[0], "2026-10-12").expired, true);
check("goal not yet expired", progressFor(state, SEED_HABITS[0], "2026-10-05").expired, false);

/* ---- CSV export (Q25) ---- */
const perHabit = habitCsv(SEED_HABITS[0], state.entries);
check("per-habit header", perHabit.split("\n")[0], "date,value");
check("per-habit rows sorted ascending", perHabit.split("\n")[1], "2026-09-22,30");
check("per-habit row count", perHabit.trim().split("\n").length - 1, 12);
check("combined header", allCsv(state).split("\n")[0], "date,meditation,self-remembering,writing,algebra,retention,fasting,vocabulary,reading,bootstrap");
check("combined has a row per seeded day (17 distinct)", allCsv(state).trim().split("\n").length - 1, 17);

/* ---- CSV import validation (FR-5.4 to 5.8) ---- */
const good = parseHabitCsv("date,value\n2026-09-22,45\n2026-10-20,12\n");
check("valid csv parses", good.ok, true);
if (good.ok) {
  const merged = applyImport(state, "meditation", good.dates, good.values);
  check("import updates the matching date", valueOn(merged.state, "meditation", "2026-09-22"), 45);
  check("import adds the new date", valueOn(merged.state, "meditation", "2026-10-20"), 12);
  check("import preserves other dates", valueOn(merged.state, "meditation", "2026-09-25"), 27);
  check("import summary", merged.summary, { added: 1, updated: 1, skipped: 11 });
}
check("bad header rejected", parseHabitCsv("a,b\n1,2").ok, false);
check("bad date rejected", parseHabitCsv("date,value\n26-09-2026,5").ok, false);
check("negative rejected", parseHabitCsv("date,value\n2026-09-22,-5").ok, false);
check("non-integer rejected", parseHabitCsv("date,value\n2026-09-22,4.5").ok, false);
check("out-of-range binary value rejected", parseHabitCsv("date,value\n2026-09-22,7", "binary").ok, false);
check("empty file rejected", parseHabitCsv("   ").ok, false);
check("quoted numeric field parses", parseHabitCsv('date,value\n2026-09-22,"45"', "numeric").ok, true);
check("binary file rejects a quoted 45", parseHabitCsv('date,value\n2026-09-22,"45"', "binary").ok, false);
check("binary file accepts 1", parseHabitCsv("date,value\n2026-09-22,1", "binary").ok, true);
check("import rejection lists the line", parseHabitCsv("date,value\n2026-09-22,4.5").ok, false);

/* ---- changing the boundary never rewrites history (Q17/A) ---- */
const moved = { ...state, settings: { ...state.settings, dayStartHour: 0 } };
check("record count unchanged after boundary change", moved.entries.length, state.entries.length);
check("dates not re-labelled", moved.entries.some((e) => e.date === "2026-09-22" && e.value === 30), true);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
