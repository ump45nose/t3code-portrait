// Connects to T3 Code's debugging port and runs page.js in every T3 window, now and on each reload.
// Exits when T3 Code quits (the debugging connection closes).
//
//   node src/injector.mjs --port 9338
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1] || 9338);
const source = readFileSync(new URL("./page.js", import.meta.url), "utf8");
const APP_URL = "t3code://app";

const log = (...parts) => console.log(new Date().toISOString(), ...parts);

async function browserEndpoint(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      const info = await res.json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {}
    if (Date.now() > deadline) throw new Error(`T3 Code did not open debugging port ${port} within ${timeoutMs / 1000}s`);
    await new Promise((r) => setTimeout(r, 500));
  }
}

const url = await browserEndpoint(60_000);
const ws = new WebSocket(url);
let nextId = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const id = ++nextId;
  ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
}

const attached = new Set();

async function inject(targetInfo) {
  if (targetInfo.type !== "page" || !targetInfo.url.startsWith(APP_URL)) return;
  if (attached.has(targetInfo.targetId)) return;
  attached.add(targetInfo.targetId);
  try {
    const { sessionId } = await send("Target.attachToTarget", { targetId: targetInfo.targetId, flatten: true });
    await send("Page.enable", {}, sessionId);
    await send("Page.addScriptToEvaluateOnNewDocument", { source }, sessionId);
    const r = await send("Runtime.evaluate", { expression: source }, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    log("injected", targetInfo.targetId, targetInfo.url);
  } catch (error) {
    attached.delete(targetInfo.targetId);
    log("inject failed", targetInfo.url, error.message);
  }
}

ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
    else p.resolve(msg.result);
    return;
  }
  if (msg.method === "Target.targetCreated" || msg.method === "Target.targetInfoChanged") inject(msg.params.targetInfo);
  if (msg.method === "Target.targetDestroyed") attached.delete(msg.params.targetId);
  if (msg.method === "Target.detachedFromTarget" && msg.params.targetId) attached.delete(msg.params.targetId);
});

ws.addEventListener("close", () => {
  log("T3 Code closed the debugging connection; exiting");
  process.exit(0);
});
ws.addEventListener("error", (event) => {
  log("debugging connection error", event.message || "");
});

await new Promise((r) => ws.addEventListener("open", r, { once: true }));
log("connected to", url);
await send("Target.setDiscoverTargets", { discover: true });
