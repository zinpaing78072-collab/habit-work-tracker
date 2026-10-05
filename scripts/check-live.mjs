// Verifies the LIVE GitHub Pages deployment boots, registers its service
// worker, and still works with the network cut. Run against the real URL.
import { launch, sleep, summary, check } from "./cdp.mjs";

const URL_BASE = process.env.APP_URL ?? "https://zinpaing78072-collab.github.io/habit-work-tracker/";
const app = await launch();
const { send, js, consoleErrors } = app;

await send("Page.navigate", { url: URL_BASE });
for (let i = 0; i < 60; i++) {
  if (await js(`document.querySelectorAll(".card").length === 9`)) break;
  await sleep(400);
}

check("live app boots with 9 habit cards", await js(`document.querySelectorAll(".card").length`), 9);
check("styled (not raw HTML)", await js(`getComputedStyle(document.querySelector(".tabbar")).position`), "fixed");
check("no horizontal overflow at 375px", await js(`document.documentElement.scrollWidth <= 375`), true);
check("tab bar rendered", await js(`document.querySelectorAll(".tab").length`), 4);
check("count strip rendered", await js(`document.querySelector(".count strong").textContent.includes("of 9 logged")`), true);

const goalText = await js(`Array.from(document.querySelectorAll(".goal-count")).map(e=>e.textContent).join(" | ")`);
check("live goal progress shows 82 / 200 min", goalText.includes("82 / 200 min"), true);
check("live goal progress shows 460 / 500", goalText.includes("460 / 500"), true);
check("live goal progress shows 240 / 600", goalText.includes("240 / 600"), true);

check("manifest fetched", await js(`fetch("./manifest.webmanifest").then(r=>r.ok).catch(()=>false)`), true);
check("display mode is standalone", await js(`fetch("./manifest.webmanifest").then(r=>r.json()).then(m=>m.display).catch(()=>null)`), "standalone");

const sw = await js(`navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false)`);
check("service worker is active on the live site", sw, true);

// Write something, then confirm the network can be cut and the app still runs.
await js(`document.querySelectorAll(".card")[0].querySelectorAll(".chip")[1].click(); true`);
await sleep(500);
check("logging works on the live site", await js(`document.querySelectorAll(".card")[0].querySelector(".input").value`), "5");

await send("Network.enable");
await send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
await send("Page.reload");
await sleep(4000);
check("app boots OFFLINE from the live deploy", await js(`document.querySelectorAll(".card").length === 9`), true);
check("data survives the offline reload", await js(`document.querySelectorAll(".card")[0].querySelector(".input").value`), "5");
await send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

check("no console errors", consoleErrors, []);

app.close();
process.exit(summary("LIVE") === 0 ? 0 : 1);