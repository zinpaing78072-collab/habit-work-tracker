// Part 2b: archive/restore, export, day-boundary immutability, CSV import, offline.
import { writeFileSync } from "node:fs";
import { STUB_DOWNLOAD, check, clickTab, launch, sleep, summary, URL_BASE } from "./cdp.mjs";

const app = await launch();
const { send, js, consoleErrors } = app;

await send("Page.navigate", { url: URL_BASE });
for (let i = 0; i < 40; i++) {
  if (await js(`document.querySelectorAll(".card").length === 6`)) break;
  await sleep(300);
}
check("app booted with 9 cards", await js(`document.querySelectorAll(".card").length`), 9);

const cardIs = (name) => `Array.from(document.querySelectorAll(".card")).find(c => c.querySelector(".card-name").textContent === ${JSON.stringify(name)})`;
const newHabitPanel = `Array.from(document.querySelectorAll(".panel")).find(p => p.querySelector(".panel-name")?.textContent === "New habit")`;
const fileRow = (file) => `Array.from(document.querySelectorAll(".filerow")).find(r => r.textContent.includes(${JSON.stringify(file)}))`;
const dayValue = (day) => `
  (() => {
    const row = Array.from(document.querySelectorAll(".hrow")).find(r => r.querySelector(".hrow-main").textContent.includes(${JSON.stringify(day)}));
    return row ? Array.from(row.querySelectorAll(".vchip"))[0].querySelector(".vchip-n").textContent : "none";
  })()
`;

/* ---- create then archive a habit: data must survive ---- */
await js(clickTab("Settings"));
await sleep(600);
await js(`(() => {
  const panel = ${newHabitPanel};
  panel.querySelector(".labelled .textinput").value = "Push-ups";
  Array.from(panel.querySelectorAll(".btn")).find(b => b.textContent === "Create habit").click();
  return true;
})()`);
await sleep(600);
await js(clickTab("Today"));
await sleep(500);
check("custom habit visible on Today", await js(`!!${cardIs("Push-ups")}`), true);
await js(`(${cardIs("Push-ups")}).querySelectorAll(".chip")[1].click(); true`);
await sleep(400);
check("custom habit logged 5", await js(`(${cardIs("Push-ups")}).querySelector(".input").value`), "5");

await js(clickTab("Settings"));
await sleep(600);
await js(`(() => {
  window.confirm = () => true;
  const row = Array.from(${newHabitPanel}.querySelectorAll(".filerow")).find(r => r.textContent.includes("Push-ups"));
  Array.from(row.querySelectorAll(".btn")).find(b => b.textContent === "Archive").click();
  return true;
})()`);
await sleep(700);
check("archived habit offers Restore", await js(`document.body.textContent.includes("Restore")`), true);
check("archived habit still exports its CSV", await js(`document.body.textContent.includes("push-ups.csv")`), true);
check("archived habit row is labelled as archived", await js(`document.body.textContent.includes("push-ups.csv (archived)")`), true);

await js(clickTab("Today"));
await sleep(500);
check("archived habit hidden from Today", await js(`!${cardIs("Push-ups")}`), true);
check("Today back to 9 cards", await js(`document.querySelectorAll(".card").length`), 9);
await js(clickTab("Settings"));
await sleep(600);

/* ---- export clears the unbacked flag (Q14/C) ---- */
check("unbacked warning before export", await js(`document.querySelector(".warn").textContent.includes("never been exported")`), true);
await js(STUB_DOWNLOAD);
await js(`Array.from(document.querySelectorAll(".btn")).find(b => b.textContent.includes("all.csv")).click(); true`);
await sleep(800);
check("unbacked warning cleared after export", await js(`!document.querySelector(".warn") || !document.querySelector(".warn").textContent.includes("never been exported")`), true);
check("unbacked dot cleared after export", await js(`!document.querySelector(".tab-dot")`), true);
check("last export timestamp recorded", await js(`!document.body.textContent.includes("Last export: never")`), true);

/* ---- changing the day boundary must NOT rewrite history (Q17/A) ---- */
await js(clickTab("History"));
await sleep(600);
const rowsBeforeBoundary = await js(`document.querySelectorAll(".hrow").length`);
await js(clickTab("Settings"));
await sleep(600);
await js(`(() => {
  const l = Array.from(document.querySelectorAll(".labelled")).find(l => l.textContent.includes("Day starts at"));
  l.querySelector(".textinput").value = "0";
  Array.from(l.querySelectorAll(".btn")).find(b => b.textContent === "Save").click();
  return true;
})()`);
await sleep(700);
check("day boundary saved as 0", await js(`Array.from(document.querySelectorAll(".labelled")).find(l => l.textContent.includes("Day starts at")).querySelector(".textinput").value`), "0");
await js(clickTab("History"));
await sleep(600);
check("history row count unchanged after boundary change", await js(`document.querySelectorAll(".hrow").length`), rowsBeforeBoundary);
check("seeded 22 Sep still shows 30 after the boundary change", await js(dayValue("22")), "30");


/* ---- import a valid per-habit CSV through the real file input ---- */
await js(clickTab("Settings"));
await sleep(600);
const upload = (file, csv) => `(async () => {
  const row = ${fileRow(file)};
  window.confirm = () => true;
  const input = row.querySelector(".hidden-file");
  const dt = new DataTransfer();
  dt.items.add(new File([${JSON.stringify(csv)}], "upload.csv", { type: "text/csv" }));
  input.files = dt.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
  await new Promise(r => setTimeout(r, 1000));
  const t = document.getElementById("toast");
  return t ? t.textContent : "";
})()`;

// 2026-10-01 already exists in the seed, so use a genuinely new date for the "added" case.
const importMsg = await js(upload("meditation.csv", "date,value\n2026-09-22,45\n2026-10-20,12\n"));
check("import reported 1 added and 1 updated", /1 added, 1 updated/.test(String(importMsg)), true);

await js(clickTab("History"));
await sleep(700);
check("imported 22 Sep replaced the old 30", await js(dayValue("22")), "45");
// The default History window ends today, so 20 Oct falls outside it.
// Widen the To filter to prove the new day was actually stored.
await js(`(() => {
  const to = document.querySelectorAll(".dateinput")[1];
  to.value = "2026-10-25";
  to.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
})()`);
await sleep(700);
check("import added a new Oct 20 day", await js(`document.body.textContent.includes("Oct 20")`), true);
check("Oct 20 shows the imported value 12", await js(dayValue("Oct 20")), "12");

/* ---- invalid CSVs are rejected and write nothing ---- */
await js(clickTab("Settings"));
await sleep(600);
const badMsg = await js(upload("meditation.csv", "date,value\n26-09-2026,5\n"));
check("bad date rejected with a reason", /import rejected/.test(String(badMsg)), true);
check("rejection explains the date problem", /not a valid YYYY-MM-DD/.test(String(badMsg)), true);

const negMsg = await js(upload("meditation.csv", "date,value\n2026-09-22,-5\n"));
check("negative value rejected", /import rejected/.test(String(negMsg)), true);

const binMsg = await js(upload("retention.csv", "date,value\n2026-09-22,45\n"));
check("binary habit rejects 45", /import rejected/.test(String(binMsg)), true);
check("binary rejection mentions 0 or 1", /only 0 or 1/.test(String(binMsg)), true);

await js(clickTab("History"));
await sleep(600);
check("22 Sep unchanged after all the rejected imports", await js(dayValue("22")), "45");

/* ---- PWA: service worker, manifest, and true offline boot ---- */
check("service worker is active", await js(`navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false)`), true);
check("manifest declares standalone display", await js(`fetch("./manifest.webmanifest").then(r => r.json()).then(m => m.display).catch(() => null)`), "standalone");
check("apple touch icon is linked", await js(`!!document.querySelector('link[rel="apple-touch-icon"]')`), true);

await send("Network.enable");
await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await send("Page.reload");
await sleep(3500);
check("app boots with the network offline", await js(`document.querySelectorAll(".hrow").length > 0 || document.querySelectorAll(".card").length > 0`), true);
check("offline app shows the tab bar", await js(`!!document.querySelector(".tabbar")`), true);
check("offline app restored the last view (History)", await js(`document.querySelector(".tab.is-active").textContent`), "History");
await sleep(400);
check("offline history still lists days", await js(`document.querySelectorAll(".hrow").length > 0`), true);
check("offline history keeps the imported value", await js(dayValue("22")), "45");
check("offline history shows the imported Oct 20 day", await js(`document.body.textContent.includes("Oct 20")`), true);
await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

check("no console errors across the whole run", consoleErrors, []);

/* ---- screenshot for the record ---- */
await js(clickTab("Today"));
await sleep(900);
const shot = await send("Page.captureScreenshot", { format: "png" });
writeFileSync("/tmp/hwt-today.png", Buffer.from(shot.result.data, "base64"));
console.log("screenshot -> /tmp/hwt-today.png");

app.close();
process.exit(summary("PART 2B") === 0 ? 0 : 1);
