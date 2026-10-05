// Verifies the built app works when served from a SUBDIRECTORY, which is exactly
// how GitHub Pages hosts it (https://user.github.io/habit-work-tracker/).
import { launch, sleep, summary, check } from "./cdp.mjs";

const app = await launch();
const { send, js, consoleErrors } = app;

await send("Page.navigate", { url: process.env.APP_URL ?? "http://localhost:4188/habit-work-tracker/" });
for (let i = 0; i < 40; i++) {
  if (await js(`document.querySelectorAll(".card").length === 9`)) break;
  await sleep(300);
}

check("app boots from a subpath", await js(`document.querySelectorAll(".card").length`), 9);
check("stylesheet loaded", await js(`getComputedStyle(document.querySelector(".tabbar")).position`), "fixed");
check("no unstyled/broken layout", await js(`document.documentElement.scrollWidth <= 375`), true);
check("script bundle executed", await js(`!!document.querySelector(".tabbar")`), true);

check("manifest loads from the subpath", await js(`fetch("./manifest.webmanifest").then(r => r.ok).catch(() => false)`), true);
check("manifest start_url is relative", await js(`fetch("./manifest.webmanifest").then(r => r.json()).then(m => m.start_url).catch(() => null)`), "./");
check("apple touch icon reachable", await js(`
  fetch("./icons/apple-touch-icon-180.png").then(r => r.ok).catch(() => false)
`), true);

const sw = await js(`navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false)`);
check("service worker registers from the subpath", sw, true);

check("no console errors", consoleErrors, []);

app.close();
process.exit(summary("SUBPATH") === 0 ? 0 : 1);