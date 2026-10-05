// Drives the built app in headless Chrome at iPhone X size (375x812).
// Part 1: first run, seeded UI, logging, persistence, backdating.
import { writeFileSync } from "node:fs";
import { $, $$, STUB_DOWNLOAD, cardByName, check, clickTab, launch, sleep, summary, URL_BASE } from "./cdp.mjs";

const app = await launch();
const { chrome, send, js, consoleErrors } = app;

await send("Page.navigate", { url: URL_BASE });
await sleep(2500);

/* ---- first run ---- */
check("app mounted", await js(`${$("#app")} ? true : false`), true);
check("nine habit cards rendered", await js(`${$$(".card")}.length`), 9);
check("seed notice shown", await js(`!!${$(".seedbanner")}`), true);
check("count strip present", await js(`${$(".count strong")}?.textContent?.includes("of 9 logged")`), true);
check("no horizontal overflow at 375px", await js(`document.documentElement.scrollWidth <= 375`), true);
check("tab bar has 4 tabs", await js(`${$$(".tab")}.length`), 4);

/* ---- goal progress shows range totals (all values are range-based, not today-based) ---- */
const goalText = await js(`Array.from(${$$(".goal-count")}).map(e=>e.textContent).join(" | ")`);
check("meditation goal shows 82 / 200 min", goalText.includes("82 / 200 min"), true);
check("vocabulary goal shows 25 / 250 words", goalText.includes("25 / 250 words"), true);
check("algebra goal shows 138 / 480 min", goalText.includes("138 / 480 min"), true);
check("self-remembering goal shows 460 / 500", goalText.includes("460 / 500"), true);
check("bootstrap goal shows 240 / 600", goalText.includes("240 / 600"), true);
check("retention goal shows 2 / 3", goalText.includes("2 / 3"), true);
check("goal bar is a neutral colour, not today green/red", await js(`
  const bar = document.querySelector(".goal-fill");
  const bg = getComputedStyle(bar).backgroundColor;
  bg !== "rgb(47, 191, 113)" && bg !== "rgb(229, 72, 77)"
`), true);

/* ---- date helpers so every test is independent of "today" ---- */
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
const EMPTY_DAY = "2026-09-20"; // no entries in the seed
const SEEDED_DAY = "2026-09-25";
console.log(`(today is ${logicalTodayNode()})`);

/** Step back from today to a fixed date. */
async function goToDay(iso) {
  const steps = daysBetween(iso, logicalTodayNode());
  for (let i = 0; i < steps; i++) {
    await js(`${$$(".navbtn")}[0].click(); true`);
    await sleep(150);
  }
  return steps;
}

/* ---- logging happens on a fixed EMPTY day, so results are reproducible ---- */
console.log(`stepping back ${daysBetween(EMPTY_DAY, logicalTodayNode())} day(s) to ${EMPTY_DAY}`);
await goToDay(EMPTY_DAY);
check("empty day shows zero values", await js(`${$$(".card")}[0].querySelector(".input").value`), "0");
check("empty day has no green cards", await js(`${$$(".card-green")}.length`), 0);
check("empty day counts 0 logged", await js(`${$(".count strong")}.textContent`), "0 of 9 logged");

/* ---- tapping a stepper saves immediately (meditation steps are 1, 5, 10) ---- */
check("chips are +1 / +5 / +10 for meditation", await js(`Array.from(${$$(".card")}[0].querySelectorAll(".chip")).map(c=>c.textContent).join(",")`), "+1,+5,+10");
await js(`${$$(".card")}[0].querySelectorAll(".chip")[1].click(); true`);
await sleep(400);
check("after tapping +5, value is 5", await js(`${$$(".card")}[0].querySelector(".input").value`), "5");
check("card turned green", await js(`${$$(".card")}[0].classList.contains("card-green")`), true);
check("count updated to 1 of 9", await js(`${$(".count strong")}.textContent`), "1 of 9 logged");
check("badge says Logged", await js(`${$$(".card")}[0].querySelector(".badge").textContent.includes("Logged")`), true);

/* ---- typing a value replaces (does not accumulate) ---- */
await js(`(() => {
  const i = ${$$(".card")}[0].querySelector(".input");
  i.value = "17";
  i.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`);
await sleep(400);
check("typed value replaces the entry", await js(`${$$(".card")}[0].querySelector(".input").value`), "17");

/* ---- the +/- steppers work ---- */
await js(`${$$(".card")}[0].querySelector(".step:last-of-type").click(); true`);
await sleep(350);
const afterPlus = await js(`${$$(".card")}[0].querySelector(".input").value`);
check("plus stepper adds the habit's largest step (10)", afterPlus, "27");

/* ---- binary habit: Success toggles green, Fail toggles red ---- */
await js(`${cardByName("Retention")}.querySelector(".toggle-on").click(); true`);
await sleep(400);
check("retention shows Success", await js(`${cardByName("Retention")}.querySelector(".badge").textContent.includes("Success")`), true);
check("binary card turned green", await js(`${cardByName("Retention")}.classList.contains("card-green")`), true);

await js(`${cardByName("Retention")}.querySelector(".toggle-off").click(); true`);
await sleep(400);
check("retention now shows Fail", await js(`${cardByName("Retention")}.querySelector(".badge").textContent.includes("Fail")`), true);
check("explicit fail is NOT logged-out (still red, not neutral)", await js(`${cardByName("Retention")}.classList.contains("card-green")`), false);
check("explicit fail still counts as logged", await js(`${$(".count strong")}.textContent`), "2 of 9 logged");

await js(`${cardByName("Retention")}.querySelector(".toggle-on").click(); true`);
await sleep(350);

/* ---- persistence across a full reload (IndexedDB) ---- */
await send("Page.reload");
await sleep(2500);
await goToDay(EMPTY_DAY);
check("numeric value persisted after reload", await js(`${$$(".card")}[0].querySelector(".input").value`), "27");
check("binary success persisted", await js(`${cardByName("Retention")}.classList.contains("card-green")`), true);
check("count persisted", await js(`${$(".count strong")}.textContent`), "2 of 9 logged");
check("seed banner still shown (not yet dismissed)", await js(`!!${$(".seedbanner")}`), true);

/* ---- dismiss the seed banner ---- */
await js(`${$(".seedbanner .btn")}.click(); true`);
await sleep(300);
check("seed banner dismissed", await js(`!!${$(".seedbanner")}`), false);

/* ---- a seeded day shows its seeded values (range-based, so stable over time) ---- */
await js(`Array.from(${$$(".btn")}).find(b=>b.textContent==="Back to today").click(); true`);
await sleep(400);
check("returned to today", await js(`${$(".navlabel-main")}.textContent`), "Today");
check("next-day arrow disabled on today", await js(`${$$(".navbtn")}[1].disabled`), true);

await goToDay(SEEDED_DAY);
check("moved to a past day", await js(`!!${$(".main .btn-ghost.btn-block")}`), true);
check("seeded 25 Sep meditation value (27)", await js(`${$$(".card")}[0].querySelector(".input").value`), "27");
check("seeded 25 Sep reading value (1)", await js(`(${cardByName("Reading")}).querySelector(".input").value`), "1");
check("seeded 25 Sep bootstrap value (90)", await js(`(${cardByName("Bootstrap")}).querySelector(".input").value`), "90");
check("seeded 25 Sep writing value is 0 (no entry)", await js(`(${cardByName("Writing")}).querySelector(".input").value`), "0");
check("seeded 25 Sep counts 6 logged", await js(`${$(".count strong")}.textContent`), "6 of 9 logged");
check("seeded 25 Sep has 5 green habits", await js(`${$$(".card-green")}.length`), 5);

await js(`Array.from(${$$(".btn")}).find(b=>b.textContent==="Back to today").click(); true`);
await sleep(400);
check("back on today", await js(`${$(".navlabel-main")}.textContent`), "Today");

/* ---- no runtime errors so far ---- */
check("no console errors in part 1", consoleErrors, []);
void STUB_DOWNLOAD;

writeFileSync("/tmp/hwt-part1-done", "ok");
app.close();
process.exit(summary("PART 1") === 0 ? 0 : 1);
