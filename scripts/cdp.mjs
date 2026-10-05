// Shared headless-Chrome plumbing for the smoke tests.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
export const URL_BASE = process.env.APP_URL ?? "http://localhost:4177/";
const PORT = 9222;

let failures = 0;
export function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}
export function summary(label) {
  console.log(failures === 0 ? `\nALL ${label} CHECKS PASSED` : `\n${failures} ${label} CHECK(S) FAILED`);
  return failures;
}
export { sleep };

export async function launch({ width = 375, height = 812 } = {}) {
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--disable-gpu",
    "--no-first-run",
    "--user-data-dir=/tmp/hwt-chrome-profile",
    `--window-size=${width},${height}`,
    "about:blank",
  ], { stdio: "ignore" });

  let target;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) {
        target = page;
        break;
      }
    } catch {}
    await sleep(250);
  }
  if (!target) throw new Error("Chrome DevTools endpoint never became ready");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let msgId = 0;
  const pending = new Map();
  const consoleErrors = [];
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") consoleErrors.push(m.params.entry.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      consoleErrors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    }
  };

  function send(method, params = {}) {
    const id = ++msgId;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function js(expression) {
    const res = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
    return res.result?.result?.value;
  }

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 2, mobile: true });
  await send("Emulation.setUserAgentOverride", {
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
  });

  return { chrome, ws, send, js, consoleErrors, close: () => { ws.close(); chrome.kill(); } };
}

export const $ = (sel) => `document.querySelector(${JSON.stringify(sel)})`;
export const $$ = (sel) => `document.querySelectorAll(${JSON.stringify(sel)})`;
/** Click the tab with the given label. */
export const clickTab = (label) => `Array.from(${$$(".tab")}).find(t=>t.textContent==="${label}").click(); true`;
/** Find a card by its displayed habit name. */
export const cardByName = (name) =>
  `Array.from(${$$(".card")}).find(c=>c.querySelector(".card-name").textContent==="${name}")`;
export const panelByName = (name) =>
  `Array.from(${$$(".panel")}).find(p=>p.querySelector(".panel-name")?.textContent==="${name}")`;

/** Stub anchor downloads so headless Chrome never touches the filesystem. */
export const STUB_DOWNLOAD = `
  window.__realCreate = URL.createObjectURL;
  URL.createObjectURL = () => "blob:stub";
  URL.revokeObjectURL = () => {};
  window.__realClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {};
  true
`;
