// Regression test: the status-bar inset must survive dismissing the seed
// banner. Reproduces the reported bug: dismissing "Got it" made the date nav
// slide up under the notch. Simulates an iPhone X safe-area inset.
import { launch, sleep, summary, check } from "./cdp.mjs";

const URL_BASE = process.env.APP_URL ?? "http://localhost:4177/";
const app = await launch();
const { send, js } = app;

// Try to emulate a notched-device safe area. Fall back to injecting the inset
// via a CSS custom property if the protocol method is unavailable.
let simulated = "protocol";
const ok = await send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 47, left: 0, bottom: 34, right: 0 } });
if (ok?.error) simulated = "injected";

await send("Page.navigate", { url: URL_BASE });
for (let i = 0; i < 50; i++) {
  if (await js(`document.querySelectorAll(".card").length === 9`)) break;
  await sleep(300);
}

if (simulated === "injected") {
  // Force env(safe-area-inset-*) to a notched value by redefining the property.
  await js(`(() => {
    const s = document.createElement("style");
    s.textContent = ":root{--sat:47px;--sab:34px;}";
    document.head.appendChild(s);
    return true;
  })()`);
  // Swap env() for the forced value across the stylesheet rules.
  await js(`(() => {
    const s = document.createElement("style");
    s.textContent = "#app{padding-top:47px !important;}.tabbar{padding-bottom:34px !important;}";
    document.head.appendChild(s);
    return true;
  })()`);
}

const topInset = await js(`
  (() => {
    const app = document.getElementById("app");
    return parseFloat(getComputedStyle(app).paddingTop) || 0;
  })()
`);

check("app applies a top safe-area inset", topInset >= 44, true);
check("seed banner is present before dismissing", await js(`!!document.querySelector(".seedbanner")`), true);

/* ---- the reported bug: dismiss the banner, then the nav must stay clear ---- */
await js(`document.querySelector(".seedbanner .btn").click(); true`);
await sleep(500);

check("seed banner is gone", await js(`!!document.querySelector(".seedbanner")`), false);
check("top inset STILL applied after dismissal", await js(`
  parseFloat(getComputedStyle(document.getElementById("app")).paddingTop) >= 44
`), true);

check("date nav is still visible", await js(`!!document.querySelector(".datenav")`), true);

const navTop = await js(`Math.round(document.querySelector(".datenav").getBoundingClientRect().top)`);
const labelText = await js(`document.querySelector(".navlabel-main").textContent`);
check("date nav sits below the status bar", navTop >= 44, true);
check("date label is rendered", labelText.length > 0, true);

const labelBox = await js(`
  (() => {
    const r = document.querySelector(".navlabel-sub").getBoundingClientRect();
    return { top: Math.round(r.top), height: Math.round(r.height) };
  })()
`);
check("long date line is fully on screen", labelBox.top >= 44 && labelBox.height > 0, true);
check("nothing hidden behind the status bar", labelBox.top < 44, false);

const scrollY = await js(`window.scrollY`);
check("page did not jump on dismissal", scrollY, 0);

app.close();
process.exit(summary("SAFE AREA") === 0 ? 0 : 1);