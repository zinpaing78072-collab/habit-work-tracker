// Part 2a: history, goals, and settings/custom habits.
import { $, $$, cardByName, check, clickTab, launch, panelByName, sleep, summary, URL_BASE } from "./cdp.mjs";

const app = await launch();
const { send, js, consoleErrors } = app;

await send("Page.navigate", { url: URL_BASE });
await sleep(2500);

// Wait for the app to finish booting rather than guessing at a fixed delay.
for (let i = 0; i < 40; i++) {
  if (await js(`document.querySelectorAll(".card").length === 9`)) break;
  await sleep(300);
}
check("app booted with 9 cards", await js(`document.querySelectorAll(".card").length`), 9);

// Log on a FIXED empty day so the numbers below are reproducible.
// Each step re-queries the DOM because every change re-renders the screen.
const pad = (n) => String(n).padStart(2, "0");
function logicalTodayNode(dayStartHour = 4, now = new Date()) {
  const shifted = new Date(now.getTime() - dayStartHour * 3_600_000);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}
function daysBetween(a, b) {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}
const EMPTY_DAY = "2026-09-20";
const today = logicalTodayNode();
console.log(`(today is ${today}; logging on the fixed empty day ${EMPTY_DAY})`);

for (let i = 0; i < daysBetween(EMPTY_DAY, logicalTodayNode()); i++) {
  await js(`document.querySelectorAll(".navbtn")[0].click(); true`);
  await sleep(150);
}
await js(`document.querySelectorAll(".card")[0].querySelectorAll(".chip")[1].click(); true`);
await sleep(400);
await js(`Array.from(document.querySelectorAll(".card")).find(c => c.querySelector(".card-name").textContent === "Fasting").querySelector(".toggle-on").click(); true`);
await sleep(400);
await js(`Array.from(document.querySelectorAll(".btn")).find(b => b.textContent === "Back to today").click(); true`);
await sleep(400);

/* ---- history ---- */
await js(clickTab("History"));
await sleep(600);

// Meditation's lifetime is 414; the fixed empty day gained +5, so History shows 419.
const historyMeditationTotal = "419";

check("history shows every day", await js(`document.querySelectorAll(".hrow").length >= 17`), true);
check("history shows 9 habit chips per day", await js(`document.querySelectorAll(".hrow")[0].querySelectorAll(".vchip").length`), 9);
check("history totals grid has 9 totals", await js(`${$$(".total")}.length`), 9);
check(`history meditation total is ${historyMeditationTotal} (414 seed + 5)`, await js(`
  (() => {
    const t = Array.from(document.querySelectorAll(".total")).find(t => t.textContent.includes("Meditation"));
    return t.querySelector(".total-n").textContent;
  })()
`), historyMeditationTotal);
check("history has a From/To range filter", await js(`${$$(".dateinput")}.length`), 2);
check("history shows 18 seeded days plus the backfilled one", await js(`document.querySelectorAll(".hrow").length`), 18);

/* ---- history edit jumps to that day ---- */
await js(`(() => {
  const row = Array.from(document.querySelectorAll(".hrow")).find(r => r.querySelector(".hrow-main").textContent.includes("25"));
  Array.from(row.querySelectorAll(".btn")).find(b => b.textContent === "Edit").click();
  return true;
})()`);
await sleep(600);
check("Edit leaves the History screen", await js(`document.querySelector(".tab.is-active").textContent`), "Today");
check("back-to-today button offered on a past day", await js(`!!document.querySelector(".main .btn-ghost.btn-block")`), true);
check("25 Sep shows the seeded meditation value (27)", await js(`document.querySelectorAll(".card")[0].querySelector(".input").value`), "27");
await js(`Array.from(document.querySelectorAll(".btn")).find(b=>b.textContent==="Back to today").click(); true`);
await sleep(400);
check("back on today", await js(`document.querySelector(".navlabel-main").textContent`), "Today");

/* ---- goals ---- */
await js(clickTab("Goals"));
await sleep(600);
check("goals lists 9 habits", await js(`${$$(".panel")}.length`), 9);
check("meditation target prefilled with 200", await js(`(${panelByName("Meditation")}).querySelectorAll(".textinput")[0].value`), "200");
check("meditation range prefilled", await js(`
  Array.from((${panelByName("Meditation")}).querySelectorAll(".textinput")).slice(1, 3).map(i=>i.value).join(" -> ")
`), "2026-10-02 -> 2026-10-11");
// The active goal covers 2-11 Oct, which the fixed 20 Sep edit falls outside of.
check("goal line states the range total (82 / 200 min)", await js(`
  (${panelByName("Meditation")}).querySelector(".panel-line").textContent.includes("82 / 200 min")
`), true);

/* ---- completed goals are shown as read-only history ---- */
check("meditation lists 2 completed goals", await js(`(${panelByName("Meditation")}).querySelectorAll(".completed-row").length`), 2);
check("completed row shows the 332 result", await js(`
  Array.from((${panelByName("Meditation")}).querySelectorAll(".completed-text")).some(t => t.textContent.includes("332 / 332 min"))
`), true);
check("completed row shows the 124 result", await js(`
  Array.from((${panelByName("Meditation")}).querySelectorAll(".completed-text")).some(t => t.textContent.includes("124 / 124 min"))
`), true);
check("completed goals have no editor controls", await js(`(${panelByName("Meditation")}).querySelectorAll(".completed .textinput").length`), 0);
check("writing unit field is editable", await js(`
  (() => {
    const p = ${panelByName("Writing")};
    const l = Array.from(p.querySelectorAll(".labelled")).find(l => l.textContent.includes("Unit"));
    return !l.querySelector(".textinput").disabled;
  })()
`), true);
check("retention unit field is disabled (binary)", await js(`
  (() => {
    const p = ${panelByName("Retention")};
    const l = Array.from(p.querySelectorAll(".labelled")).find(l => l.textContent.includes("Unit"));
    return l.querySelector(".textinput").disabled;
  })()
`), true);

/* ---- edit a goal; the bar reflects the new target (82 is already logged) ---- */
await js(`(() => {
  const p = ${panelByName("Meditation")};
  p.querySelectorAll(".textinput")[0].value = "80";
  Array.from(p.querySelectorAll(".btn")).find(b => /goal/i.test(b.textContent)).click();
  return true;
})()`);
await sleep(600);
check("updated target persisted", await js(`(${panelByName("Meditation")}).querySelectorAll(".textinput")[0].value`), "80");
check("goal now counts as met", await js(`(${panelByName("Meditation")}).querySelector(".goal-fill").classList.contains("goal-fill-met")`), true);

/* ---- validation rejects a zero target without saving ---- */
await js(`(() => {
  const p = ${panelByName("Vocabulary")};
  p.querySelectorAll(".textinput")[0].value = "0";
  Array.from(p.querySelectorAll(".btn")).find(b => /goal/i.test(b.textContent)).click();
  return true;
})()`);
await sleep(500);
check("zero target rejected with a toast", await js(`
  (() => { const t = document.getElementById("toast"); return !!t && t.classList.contains("show") && t.textContent.includes("greater than 0"); })()
`), true);
// The invalid value stays in the field (no re-render on rejection), so assert the
// stored goal line instead: it must still show the original 250 target.
check("rejected goal did NOT change the stored target", await js(`
  (${panelByName("Vocabulary")}).querySelector(".panel-line").textContent.includes("25 / 250 words")
`), true);

/* ---- settings ---- */
await js(clickTab("Settings"));
await sleep(700);
check("settings shows an unbacked warning", await js(`
  (() => { const w = document.querySelector(".warn"); return !!w && w.textContent.includes("never been exported"); })()
`), true);
check("settings tab shows the unbacked dot", await js(`!!${$(".tab-dot")}`), true);
check("per-habit file rows listed", await js(`${$$(".filerow")}.length >= 9`), true);
check("storage line renders", await js(`document.body.textContent.includes("available to this site") || document.body.textContent.includes("does not report storage")`), true);
check("data-loss warning present", await js(`document.body.textContent.includes("can erase your entries")`), true);
check("install instructions present", await js(`document.body.textContent.includes("Add to Home Screen")`), true);
check("seed panel lists the bundled seed size", await js(`document.body.textContent.includes("9 habits, 14 goals")`), true);
check("day boundary defaults to 4", await js(`
  Array.from(${$$(".labelled")}).find(l => l.textContent.includes("Day starts at")).querySelector(".textinput").value
`), "4");

/* ---- create a custom habit ---- */
const rowsBefore = await js(`document.querySelectorAll(".filerow").length`);
await js(`(() => {
  const panel = Array.from(${$$(".panel")}).find(p => p.querySelector(".panel-name")?.textContent === "New habit");
  panel.querySelector(".labelled .textinput").value = "Push-ups";
  Array.from(panel.querySelectorAll(".btn")).find(b => b.textContent === "Create habit").click();
  return true;
})()`);
await sleep(700);
check("custom habit created push-ups.csv", await js(`document.body.textContent.includes("push-ups.csv")`), true);
check("custom habit added to the file list", (await js(`document.querySelectorAll(".filerow").length`)) > rowsBefore, true);

await js(clickTab("Today"));
await sleep(600);
check("today now shows 10 cards", await js(`${$$(".card")}.length`), 10);
// The numerator depends on whether today itself has seeded data, so assert the
// denominator (the new habit was added) and the shape of the string.
check("count strip reflects 10 habits", await js(`${$(".count strong")}.textContent.endsWith("of 10 logged")`), true);
check("new habit card present", await js(`!!${cardByName("Push-ups")}`), true);
check("new habit has no active goal", await js(`(${cardByName("Push-ups")}).querySelector(".goal").textContent.includes("No active goal")`), true);

check("no console errors so far", consoleErrors, []);
app.close();
process.exit(summary("PART 2A") === 0 ? 0 : 1);
