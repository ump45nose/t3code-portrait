// Runs inside T3 Code's window. In a portrait window it moves the sidebar to the top and shows threads
// as two-line cards in two columns of independently scrolling sections (left: threads outside any
// group, then Settled; right: Working, then Snoozed). It gathers the sidebar's buttons into one row
// above the chat title and adds a toggle button to the chat header. Only T3's own DOM markers are used; when they are missing, nothing is changed.
(() => {
  // Clean up any previous instance on this document before initializing.
  if (typeof document.__t3pCleanup === "function") document.__t3pCleanup();
  else if (document.__t3portrait) return;
  document.__t3portrait = true;

  const KEY = "t3portrait:v1";
  const MIN_H = 15;
  const MAX_H = 70;
  const DEFAULT_H = 35;
  const MIN_BP_H = 20;
  const MAX_BP_H = 75;
  const DEFAULT_BP_H = 42;
  // T3 switches to its own mobile layout below Tailwind's md breakpoint.
  const MIN_WIDTH = 768;

  const state = { on: true, h: DEFAULT_H, bpH: DEFAULT_BP_H };
  try {
    Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}"));
  } catch {}
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  };

  // looked up on each use: the script may run before <html> exists
  const html = () => document.documentElement;
  const clampH = (h) => Math.min(MAX_H, Math.max(MIN_H, Math.round(h)));
  const clampBpH = (h) => Math.min(MAX_BP_H, Math.max(MIN_BP_H, Math.round(h)));
  const applyH = () => {
    html().style.setProperty("--t3p-h", String(clampH(state.h)));
    html().style.setProperty("--t3p-bp-h", String(clampBpH(state.bpH)));
  };

  const CSS = `
html[data-t3p="top"] [data-slot="sidebar-wrapper"] { flex-direction: column; }
/* --t3p-cur is the sidebar's current height in % of the window; it animates on collapse/expand */
@property --t3p-cur { syntax: "<number>"; inherits: true; initial-value: 35; }
html[data-t3p="top"] { --t3p-cur: var(--t3p-h); transition: --t3p-cur 260ms cubic-bezier(0.3, 0, 0, 1); }
html[data-t3p="top"]:has([data-slot="sidebar"][data-state="collapsed"]) { --t3p-cur: 0; }
html[data-t3p="top"]:has(body[data-t3p-resizing]) { transition: none; }
html[data-t3p="top"] [data-slot="sidebar-wrapper"] > [data-slot="sidebar"] {
  display: block; width: 100%; height: calc(var(--t3p-cur) * 1dvh); flex: none; overflow: hidden;
}
html[data-t3p="top"] [data-slot="sidebar-wrapper"] > [data-slot="sidebar"] [data-slot="sidebar-container"] {
  height: calc(var(--t3p-h) * 1dvh); position: relative; top: calc((var(--t3p-cur) - var(--t3p-h)) * 1dvh);
}
@media (prefers-reduced-motion: reduce) { html[data-t3p="top"] { transition: none; } }
html[data-t3p="top"] [data-slot="sidebar-gap"],
html[data-t3p="top"] [data-slot="sidebar-rail"] { display: none; }
html[data-t3p="top"] [data-slot="sidebar-container"] {
  inset: auto; left: auto; right: auto; z-index: auto;
  display: flex; width: 100%;
  border-bottom: 1px solid var(--sidebar-border);
}
html[data-t3p="top"] [data-slot="sidebar-wrapper"] > [data-slot="sidebar-inset"] { flex: 1 1 0; min-height: 0; }
html[data-t3p="top"] [data-workspace-titlebar-controls] { position: absolute; }
/* the sidebar toggle points up/down instead of left/right */
html[data-t3p="top"] [data-sidebar-control] svg { transform: rotate(90deg); }

/* title row, thread list, then one tool row right above the chat title:
   [toggle] footer buttons | search, filter, add project, new thread | back, forward */
html[data-t3p-open] [data-t3p-part="wrap"] {
  display: grid; grid-template-columns: auto minmax(0, 1fr) 76px;
  grid-template-rows: auto minmax(0, 1fr) 44px;
  grid-template-areas: "head head head" "list list list" "foot search nav";
}
html[data-t3p-open] [data-t3p-part="head"] {
  grid-area: head;
  --workspace-titlebar-content-left: calc(var(--workspace-controls-left) + 4px);
}
html[data-t3p-open] [data-t3p-part="list"] { grid-area: list; height: auto; border-bottom: 1px solid var(--sidebar-border); }
html[data-t3p-open] [data-t3p-part="foot"] { grid-area: foot; justify-content: center; padding: 0 4px 0 44px; }
html[data-t3p-open] [data-t3p-part="search"] { grid-area: search; align-self: center; }
html[data-t3p-open] [data-t3p-part="search"] > [data-slot="sidebar-group"] { padding-block: 0; }
html[data-t3p-open] [data-t3p-part="nav"] {
  position: fixed; right: 12px; top: calc(var(--t3p-cur) * 1dvh - 44px); height: 44px; z-index: 30;
}
html[data-t3p-open]:has([data-slot="sidebar"][data-state="expanded"]) [data-sidebar-control] {
  left: 10px; top: calc(var(--t3p-h) * 1dvh - 44px); height: 44px; margin-left: 0;
}
/* T3 draws these over a dark title backdrop; in the tool row they sit on the sidebar surface */
html[data-t3p-open]:has([data-slot="sidebar"][data-state="expanded"]) [data-sidebar-control] button,
html[data-t3p-open] [data-t3p-part="nav"] button { color: var(--sidebar-foreground) !important; --control-icon-color: var(--sidebar-foreground); }
html[data-t3p-open] [data-t3p-part="nav"] button:hover,
html[data-t3p-open]:has([data-slot="sidebar"][data-state="expanded"]) [data-sidebar-control] button:hover { background: var(--sidebar-accent, rgb(0 0 0 / 6%)) !important; }

/* Four sections in two columns: left = threads outside any group, then Settled; right = Working,
   then Snoozed. Each section scrolls on its own. T3 keeps every item in one flat <ul>, so script
   places each item (--t3p-x, --t3p-y) and clips it to its section (--t3p-ct, --t3p-cb). */
html[data-t3p-open] [data-t3p-part="list"] [data-slot="scroll-area-viewport"] { overflow: hidden !important; }
html[data-t3p-open] [data-t3p-part="threads"] {
  display: block; position: relative; height: var(--t3p-list-h, 100%); flex: none;
}
html[data-t3p-open] [data-t3p-part="threads"] > li {
  position: absolute; top: 0; left: 0; width: calc(50% - 4px); margin: 0; content-visibility: visible;
  transform: translate(var(--t3p-x, 0px), var(--t3p-y, 0px));
  clip-path: inset(var(--t3p-ct, 0px) -24px var(--t3p-cb, 0px) -24px);
}
html[data-t3p-open] [data-t3p-part="threads"] > li[data-t3p-hidden] { visibility: hidden; }
.t3p-sb { position: absolute; z-index: 25; width: 10px; display: none; touch-action: none; }
html[data-t3p-open] .t3p-sb[data-on] { display: block; }
.t3p-sb > i {
  position: absolute; right: 2px; width: 5px; border-radius: 3px; cursor: default;
  background: color-mix(in srgb, var(--sidebar-foreground) 22%, transparent);
  transition: width 120ms, background 120ms;
}
.t3p-sb:hover > i, .t3p-sb[data-dragging] > i {
  width: 7px; background: color-mix(in srgb, var(--sidebar-foreground) 38%, transparent);
}
/* two-line cards: project, device and agent on the first line; title and status on the second */
html[data-t3p-open] [data-t3p-part="card"] {
  height: auto; display: grid; grid-template-columns: auto minmax(0, 1fr) auto;
  column-gap: 6px; row-gap: 4px; align-items: center;
}
html[data-t3p-open] [data-t3p-part="card"] > :nth-child(1) { display: contents; }
/* first row's children: project icon (monogram or image), project name, status slot */
html[data-t3p-open] [data-t3p-part="card"] > :nth-child(1) > :first-child { grid-area: 1 / 1; }
html[data-t3p-open] [data-t3p-part="card"] > :nth-child(1) > :not(:first-child):not(:last-child) { grid-area: 1 / 2; min-width: 0; }
html[data-t3p-open] [data-t3p-part="card"] > :nth-child(1) > :last-child { grid-area: 2 / 3; margin-left: 0; }
html[data-t3p-open] [data-t3p-part="card"] > :nth-child(2) { grid-area: 2 / 1 / 3 / 3; margin-top: 0; }
html[data-t3p-open] [data-t3p-part="card"] > :nth-child(3) { grid-area: 1 / 3; margin-top: 0; justify-self: end; }

#t3p-divider {
  display: none; position: fixed; left: 0; right: 0; z-index: 40;
  top: calc(var(--t3p-cur) * 1dvh - 5px); height: 10px; cursor: row-resize; touch-action: none;
}
#t3p-divider::after {
  content: ""; position: absolute; left: 0; right: 0; top: 4px; height: 2px;
}
#t3p-divider:hover::after, #t3p-divider[data-dragging]::after { background: var(--sidebar-border); }
html[data-t3p-open]:has([data-slot="sidebar"][data-state="expanded"]) #t3p-divider { display: block; }
html[data-t3p="top"] body[data-t3p-resizing] { cursor: row-resize; user-select: none; }

[data-t3p-btn-wrap] { display: none; }
html[data-t3p] [data-t3p-btn-wrap] { display: flex; }

/* Portrait right-panel migration to the bottom (supports both inline and sheet modes) */
html[data-t3p="top"] [data-right-panel-toggle="true"] svg { transform: rotate(90deg); }
html[data-t3p="top"] [data-slot="sidebar-inset"] > div:has(> [data-chat-column]) {
  flex-direction: column;
}
html[data-t3p="top"] [data-chat-column] {
  flex: 1 1 0 !important;
  min-height: 0 !important;
}
html[data-t3p="top"] [data-chat-column][data-chat-column-maximized-away="true"] {
  display: none !important;
}
html[data-t3p="top"] [data-preview-panel-mode="inline"] {
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  border-left: 0 !important;
  transition: none !important;
}
html[data-t3p="top"] [data-preview-panel-mode="inline"][data-workspace-unavailable="true"] {
  height: 0 !important;
  flex: 0 0 0 !important;
  border-top: 0 !important;
  overflow: hidden !important;
}
html[data-t3p="top"] [data-preview-panel-mode="inline"]:not([data-workspace-unavailable="true"])[data-preview-panel-maximized="false"] {
  height: calc(var(--t3p-bp-h, 42) * 1%) !important;
  flex: none !important;
  border-top: 1px solid var(--border);
}
html[data-t3p="top"] [data-preview-panel-mode="inline"]:not([data-workspace-unavailable="true"])[data-preview-panel-maximized="true"] {
  height: 100% !important;
  flex: 1 1 0 !important;
  border-top: 0 !important;
}
/* Hide native left resize handle and stretch inner width-locked wrappers to full width */
html[data-t3p="top"] [data-preview-panel-mode="inline"] > :first-child:not(:last-child) {
  display: none !important;
}
html[data-t3p="top"] [data-preview-panel-mode="inline"] > :last-child,
html[data-t3p="top"] [data-preview-panel-mode="inline"] > :last-child > div {
  width: 100% !important;
  max-width: 100% !important;
  flex: 1 1 0 !important;
}
/* Sheet mode (narrow portrait): dock below the chat column only while open; never override [hidden] on close */
html[data-t3p="top"][data-t3p-sheet-open] [data-slot="sidebar-inset"] {
  padding-bottom: calc(var(--t3p-bp-h, 42) * 1dvh) !important;
}
html[data-t3p="top"][data-t3p-sheet-open] [data-slot="sheet-backdrop"]:has(~ [data-slot="sheet-viewport"] [data-preview-panel-mode="sheet"]),
html[data-t3p="top"][data-t3p-sheet-open] [data-slot="sheet-portal"]:has([data-preview-panel-mode="sheet"]) [data-slot="sheet-backdrop"] {
  display: none !important;
  pointer-events: none !important;
}
html[data-t3p="top"][data-t3p-sheet-open] [data-slot="sheet-viewport"]:not([hidden]):has([data-preview-panel-mode="sheet"]) {
  inset: auto 0 0 0 !important;
  top: auto !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: calc(var(--t3p-bp-h, 42) * 1dvh) !important;
  max-height: 82dvh !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: flex-end !important;
  align-items: stretch !important;
  pointer-events: auto !important;
}
html[data-t3p="top"][data-t3p-sheet-open] [data-slot="sheet-popup"][data-open]:has([data-preview-panel-mode="sheet"]) {
  position: relative !important;
  inset: auto !important;
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
  height: 100% !important;
  max-height: 100% !important;
  margin-top: 0 !important;
  border-left: 0 !important;
  border-inline-start: 0 !important;
  border-top: 1px solid var(--border) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
/* Keep the panel layout controls pinned to the chat header top-right instead of dropping into the bottom panel */
html[data-t3p="top"][data-t3p-sheet-open] [data-preview-panel-mode="sheet"] [data-panel-layout-controls] {
  position: fixed !important;
  top: var(--t3p-chat-head-top, 0px) !important;
  right: 14px !important;
  height: var(--t3p-chat-head-h, 52px) !important;
  display: flex !important;
  align-items: center !important;
  z-index: 60 !important;
  pointer-events: auto !important;
}

#t3p-bp-divider {
  display: none; position: fixed; left: 0; right: 0; z-index: 45;
  height: 10px; cursor: row-resize; touch-action: none;
}
#t3p-bp-divider[data-on] { display: block; }
#t3p-bp-divider::after {
  content: ""; position: absolute; left: 50%; top: 3px; width: 38px; height: 4px;
  transform: translateX(-50%); border-radius: 99px;
  background: color-mix(in srgb, var(--foreground) 18%, transparent);
  transition: width 120ms, background 120ms;
}
#t3p-bp-divider:hover::after, #t3p-bp-divider[data-dragging]::after {
  width: 56px; background: var(--info, #c6613f);
}

/* Composer bottom telemetry strip (cache hit + context ring + quota rings, color-coded, left of branch) */
.t3p-tel-host {
  display: flex; align-items: center; justify-content: flex-end; gap: 6px;
  padding: 2px 4px 0; min-height: 22px;
}
#t3p-telemetry {
  display: inline-flex; align-items: center; gap: 4px; flex-wrap: nowrap; flex-shrink: 0;
  margin-left: auto; margin-right: 4px; position: relative;
  font-size: 11.5px; line-height: 1; font-variant-numeric: tabular-nums;
  color: var(--muted-foreground);
  --t3p-cache-hi: #2e8555; --t3p-cache-mid: #6b8e3d;
  --t3p-ctx-lo: #4a7fb0; --t3p-ctx-mid: #28578a;
  --t3p-quota-lo: #c6613f; --t3p-quota-mid: #b54d24; --t3p-quota-in: #9c6b49;
  --t3p-spend: #736b5e;
  --t3p-warn: #c27824; --t3p-danger: #c04632;
  --t3p-track: color-mix(in srgb, var(--foreground) 13%, transparent);
}
.dark #t3p-telemetry {
  --t3p-cache-hi: #57c98a; --t3p-cache-mid: #9ec466;
  --t3p-ctx-lo: #78b0e3; --t3p-ctx-mid: #5390d9;
  --t3p-quota-lo: #d97757; --t3p-quota-mid: #e86b3a; --t3p-quota-in: #c49a7c;
  --t3p-spend: #a8a093;
  --t3p-warn: #e39d4b; --t3p-danger: #e8705e;
  --t3p-track: color-mix(in srgb, var(--foreground) 18%, transparent);
}
[data-t3p-branch-slot], [data-t3p-branch-slot] button {
  flex-shrink: 0 !important;
  min-width: max-content !important;
}
.t3p-tel-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 5px; border-radius: 7px; border: 0; background: transparent;
  color: var(--foreground); font: 500 11.5px/1 inherit; cursor: pointer;
  white-space: nowrap; transition: background 120ms;
}
.t3p-tel-btn:hover, .t3p-tel-btn[data-open] {
  background: color-mix(in srgb, var(--foreground) 6%, transparent);
}
.t3p-tel-btn .val { font-weight: 600; color: var(--foreground); }
.t3p-tel-btn[data-kind="cache"][data-tone="ok"] .val { color: var(--t3p-cache-hi); }
.t3p-tel-btn[data-kind="cache"][data-tone="mid"] .val { color: var(--t3p-cache-mid); }
.t3p-tel-btn[data-kind="ctx"][data-tone="normal"] .val { color: var(--t3p-ctx-lo); }
.t3p-tel-btn[data-kind="ctx"][data-tone="mid"] .val { color: var(--t3p-ctx-mid); }
.t3p-tel-btn[data-kind="quota"][data-tone="normal"] .val { color: var(--t3p-quota-lo); }
.t3p-tel-btn[data-kind="quota"][data-tone="mid"] .val { color: var(--t3p-quota-mid); }
.t3p-tel-btn[data-kind="spend"] .val { color: var(--t3p-spend); font-weight: 500; }
.t3p-tel-btn[data-kind="spend"] .sep { opacity: 0.45; margin: 0 1px; }
.t3p-tel-btn[data-tone="warn"] .val { color: var(--t3p-warn); }
.t3p-tel-btn[data-tone="danger"] .val { color: var(--t3p-danger); }
.t3p-tel-btn[data-tone="na"] { opacity: 0.48; }
.t3p-tel-dot {
  width: 6px; height: 6px; border-radius: 50%; flex: none;
  background: var(--muted-foreground);
}
.t3p-tel-btn[data-tone="ok"] .t3p-tel-dot { background: var(--t3p-cache-hi); }
.t3p-tel-btn[data-tone="mid"] .t3p-tel-dot { background: var(--t3p-cache-mid); }
.t3p-tel-btn[data-tone="warn"] .t3p-tel-dot { background: var(--t3p-warn); }
.t3p-tel-btn[data-tone="danger"] .t3p-tel-dot { background: var(--t3p-danger); }
.t3p-ring { width: 14px; height: 14px; transform: rotate(-90deg); flex: none; }
.t3p-ring.dual { width: 17px; height: 17px; }
.t3p-ring .trk { fill: none; stroke: var(--t3p-track); stroke-width: 2.2; }
.t3p-ring.dual .trk { stroke-width: 2; }
.t3p-ring .arc { fill: none; stroke: var(--muted-foreground); stroke-width: 2.2; stroke-linecap: round; }
.t3p-ring.dual .arc { stroke-width: 2; }
.t3p-ring .arc[data-tone="ctx"] { stroke: var(--t3p-ctx-lo); }
.t3p-ring .arc[data-tone="ctx-mid"] { stroke: var(--t3p-ctx-mid); }
.t3p-ring .arc[data-tone="quota"] { stroke: var(--t3p-quota-lo); }
.t3p-ring .arc[data-tone="quota-mid"] { stroke: var(--t3p-quota-mid); }
.t3p-ring .arc[data-tone="quota-in"] { stroke: var(--t3p-quota-in); }
.t3p-ring .arc[data-tone="warn"] { stroke: var(--t3p-warn); }
.t3p-ring .arc[data-tone="danger"] { stroke: var(--t3p-danger); }
.t3p-tel-btn[data-kind="quota"] { gap: 8px; }
.t3p-qgroup { display: inline-flex; align-items: center; gap: 3px; }
.t3p-qgroup[data-tone="normal"] .val { color: var(--t3p-quota-lo); }
.t3p-qgroup[data-tone="mid"] .val { color: var(--t3p-quota-mid); }
.t3p-qgroup[data-tone="warn"] .val { color: var(--t3p-warn); }
.t3p-qgroup[data-tone="danger"] .val { color: var(--t3p-danger); }
.t3p-qtag { font-size: 10px; font-weight: 600; color: var(--muted-foreground); letter-spacing: 0.02em; }

#t3p-tel-pop {
  position: fixed; z-index: 90; width: min(352px, calc(100vw - 20px)); display: none;
  padding: 14px 16px; border-radius: 14px;
  background: var(--popover, var(--background));
  color: var(--popover-foreground, var(--foreground));
  border: 1px solid var(--border);
  box-shadow: 0 14px 36px rgb(0 0 0 / 16%);
  font-size: 12px; line-height: 1.5; font-variant-numeric: tabular-nums;
  --t3p-pop-green: #2e8555; --t3p-pop-blue: #4a7fb0; --t3p-pop-orange: #c6613f;
  --t3p-pop-warn: #c27824; --t3p-pop-danger: #c04632;
  --t3p-pop-track: color-mix(in srgb, var(--foreground) 12%, transparent);
}
.dark #t3p-tel-pop {
  box-shadow: 0 16px 40px rgb(0 0 0 / 50%);
  --t3p-pop-green: #57c98a; --t3p-pop-blue: #78b0e3; --t3p-pop-orange: #d97757;
  --t3p-pop-warn: #e39d4b; --t3p-pop-danger: #e8705e;
  --t3p-pop-track: color-mix(in srgb, var(--foreground) 16%, transparent);
}
#t3p-tel-pop[data-open] { display: grid; gap: 10px; }
#t3p-tel-pop .psec { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
#t3p-tel-pop .psec b { font-size: 13px; font-weight: 600; color: var(--foreground); }
#t3p-tel-pop .psec small { font-size: 11.5px; color: var(--muted-foreground); }
#t3p-tel-pop .phr { height: 1px; background: var(--border); margin: -2px 0; }
#t3p-tel-pop .pr { display: flex; justify-content: space-between; align-items: center; gap: 10px; color: var(--muted-foreground); }
#t3p-tel-pop .pr b { color: var(--foreground); font-weight: 600; text-align: right; }
#t3p-tel-pop .pr .dim { color: var(--muted-foreground); font-weight: 400; margin: 0 4px; }
#t3p-tel-pop .ppill {
  display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 6px;
  font-size: 11.5px; font-weight: 600; margin-left: 6px;
  color: var(--t3p-pop-green);
  background: color-mix(in srgb, var(--t3p-pop-green) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--t3p-pop-green) 32%, transparent);
}
#t3p-tel-pop .ppill[data-tone="warn"] {
  color: var(--t3p-pop-warn);
  background: color-mix(in srgb, var(--t3p-pop-warn) 14%, transparent);
  border-color: color-mix(in srgb, var(--t3p-pop-warn) 32%, transparent);
}
#t3p-tel-pop .ppill[data-tone="danger"] {
  color: var(--t3p-pop-danger);
  background: color-mix(in srgb, var(--t3p-pop-danger) 14%, transparent);
  border-color: color-mix(in srgb, var(--t3p-pop-danger) 32%, transparent);
}
#t3p-tel-pop .psplit { display: flex; align-items: center; gap: 7px; flex: 1; justify-content: flex-end; min-width: 0; }
#t3p-tel-pop .psplit-bar {
  flex: 0 1 96px; min-width: 48px; height: 7px; border-radius: 99px; overflow: hidden;
  display: flex; background: var(--t3p-pop-track);
}
#t3p-tel-pop .psplit-think { background: var(--t3p-pop-orange); height: 100%; }
#t3p-tel-pop .psplit-body { background: var(--t3p-pop-blue); height: 100%; }
#t3p-tel-pop .pctx-row { display: flex; align-items: center; gap: 8px; }
#t3p-tel-pop .pb { flex: 1; min-width: 60px; height: 7px; border-radius: 99px; background: var(--t3p-pop-track); overflow: hidden; }
#t3p-tel-pop .pb > i { display: block; height: 100%; border-radius: 99px; background: var(--t3p-pop-blue); }
#t3p-tel-pop .pb > i[data-tone="warn"] { background: var(--t3p-pop-warn); }
#t3p-tel-pop .pb > i[data-tone="danger"] { background: var(--t3p-pop-danger); }
#t3p-tel-pop .pf { font-size: 11px; color: var(--muted-foreground); border-top: 1px solid var(--border); padding-top: 7px; display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
#t3p-tel-pop .pq-group { display: grid; gap: 8px; }
#t3p-tel-pop .pq-gtitle { font-size: 12.5px; font-weight: 600; color: var(--foreground); margin-top: 2px; }
#t3p-tel-pop .pq-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
#t3p-tel-pop .pq-left { display: grid; gap: 1px; }
#t3p-tel-pop .pq-name { color: var(--foreground); font-size: 12.5px; }
#t3p-tel-pop .pq-reset { color: var(--muted-foreground); font-size: 11px; }
#t3p-tel-pop .pq-right { display: inline-flex; align-items: center; gap: 8px; font-weight: 600; color: var(--foreground); }
#t3p-tel-pop .pq-ring { width: 18px; height: 18px; transform: rotate(-90deg); flex: none; }
#t3p-tel-pop .pq-ring .trk { fill: none; stroke: var(--t3p-pop-track); stroke-width: 2.3; }
#t3p-tel-pop .pq-ring .arc { fill: none; stroke: var(--t3p-pop-green); stroke-width: 2.3; stroke-linecap: round; }
#t3p-tel-pop .pq-ring .arc[data-tone="warn"] { stroke: var(--t3p-pop-warn); }
#t3p-tel-pop .pq-ring .arc[data-tone="danger"] { stroke: var(--t3p-pop-danger); }
`;

  const ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-top size-4" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"></rect><path d="M3 9h18"></path></svg>';
  const FALLBACK_BTN_CLASS =
    "relative inline-flex cursor-pointer select-none items-center justify-center rounded-lg border border-transparent h-7 min-w-7 px-1 text-foreground hover:bg-accent data-pressed:bg-accent data-pressed:text-accent-foreground";
  const TITLE_ON = "竖屏布局：开（边栏在顶部）";
  const TITLE_OFF = "竖屏布局：关（T3 原布局）";
  const TITLE_BROKEN = "没找到 T3 的边栏，可能是 T3 更新了界面。布局没有改动。";

  let style;
  let divider;
  let bpDivider;
  let btnWrap;
  let btn;
  let broken = false;
  let telBar;
  let telPop;
  let telHostFallback;
  let telOpenKind = null;
  let lastTelSig = "";
  let lastTelData = null;

  function ensureStyle() {
    if (style?.isConnected) return;
    style = document.createElement("style");
    style.id = "t3p-style";
    style.textContent = CSS;
    (document.head || html()).appendChild(style);
  }

  function startRowDrag(el, e, onMove, onDone) {
    if (e.button !== 0) return;
    e.preventDefault();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {}
    el.setAttribute("data-dragging", "");
    document.body.setAttribute("data-t3p-resizing", "");
    let finished = false;
    const end = () => {
      if (finished) return;
      finished = true;
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      window.removeEventListener("blur", end);
      el.removeEventListener("lostpointercapture", end);
      try {
        if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
      } catch {}
      el.removeAttribute("data-dragging");
      document.body.removeAttribute("data-t3p-resizing");
      save();
      onDone?.();
    };
    const move = (ev) => {
      if (ev.buttons === 0) {
        end();
        return;
      }
      onMove(ev);
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
    window.addEventListener("blur", end);
    el.addEventListener("lostpointercapture", end);
  }

  function ensureDivider() {
    if (divider?.isConnected) return;
    divider = document.createElement("div");
    divider.id = "t3p-divider";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", "horizontal");
    divider.title = "拖动调整边栏高度，双击恢复默认";
    divider.addEventListener("pointerdown", (e) => {
      startRowDrag(divider, e, (ev) => {
        state.h = clampH((ev.clientY / window.innerHeight) * 100);
        applyH();
      });
    });
    divider.addEventListener("dblclick", () => {
      state.h = DEFAULT_H;
      applyH();
      save();
    });
    document.body.appendChild(divider);
  }

  function ensureBpDivider() {
    if (bpDivider?.isConnected) return;
    bpDivider = document.createElement("div");
    bpDivider.id = "t3p-bp-divider";
    bpDivider.setAttribute("role", "separator");
    bpDivider.setAttribute("aria-orientation", "horizontal");
    bpDivider.title = "拖动调整底部面板高度，双击恢复默认";
    bpDivider.addEventListener("pointerdown", (e) => {
      const panel = findActiveBottomPanel();
      if (!panel) return;
      const isSheet = panel.getAttribute("data-preview-panel-mode") === "sheet";
      const containerRect = isSheet
        ? { top: 0, bottom: window.innerHeight, height: window.innerHeight }
        : (panel.parentElement?.getBoundingClientRect() || { top: 0, bottom: window.innerHeight, height: window.innerHeight });
      startRowDrag(
        bpDivider,
        e,
        (ev) => {
          const hPx = Math.max(0, containerRect.bottom - ev.clientY);
          state.bpH = clampBpH((hPx / Math.max(1, containerRect.height)) * 100);
          applyH();
          syncBottomPanel();
        },
        syncBottomPanel,
      );
    });
    bpDivider.addEventListener("dblclick", () => {
      state.bpH = DEFAULT_BP_H;
      applyH();
      save();
      syncBottomPanel();
    });
    document.body.appendChild(bpDivider);
  }

  function findActiveBottomPanel() {
    if (html().getAttribute("data-t3p") !== "top") return null;
    const inline = document.querySelector(
      '[data-preview-panel-mode="inline"]:not([data-workspace-unavailable="true"])[data-preview-panel-maximized="false"]',
    );
    if (inline && inline.getBoundingClientRect().height > 20) return inline;
    const sheet = document.querySelector('[data-preview-panel-mode="sheet"]');
    if (sheet) {
      const pop = sheet.closest('[data-slot="sheet-popup"]');
      const open = pop ? pop.hasAttribute("data-open") : sheet.getBoundingClientRect().height > 20;
      if (open) return sheet;
    }
    return null;
  }

  function syncBottomPanel() {
    ensureBpDivider();
    const panel = findActiveBottomPanel();
    const isSheet = panel?.getAttribute("data-preview-panel-mode") === "sheet";
    setAttr("data-t3p-sheet-open", isSheet ? "" : null);
    const header = document.querySelector("[data-chat-header]");
    if (header) {
      const hr = header.getBoundingClientRect();
      setVar(html(), "--t3p-chat-head-top", `${Math.round(hr.top)}px`);
      setVar(html(), "--t3p-chat-head-h", `${Math.round(hr.height)}px`);
    }
    toggle(bpDivider, "data-on", !!panel);
    if (panel) {
      const r = panel.getBoundingClientRect();
      setVar(bpDivider, "top", `${Math.round(r.top - 5)}px`);
    } else if (bpDivider.hasAttribute("data-dragging")) {
      bpDivider.removeAttribute("data-dragging");
      document.body.removeAttribute("data-t3p-resizing");
    }
  }

  /* ==================== Composer bottom telemetry (cache + context ring + quota rings) ==================== */
  const fmtTokens = (n) => {
    if (n == null || !Number.isFinite(n)) return "—";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/\.?0+$/, "")}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1).replace(/\.0$/, "")}k`;
    return String(Math.round(n));
  };

  const fmtReset = (iso) => {
    if (!iso) return "";
    const ms = Date.parse(iso) - Date.now();
    if (!Number.isFinite(ms) || ms <= 0) return "即将重置";
    const mins = Math.round(ms / 60_000);
    if (mins < 60) return `${mins} 分钟后重置`;
    const hrs = Math.floor(mins / 60);
    const remM = mins % 60;
    if (hrs < 24) return remM ? `${hrs} 小时 ${remM} 分钟后重置` : `${hrs} 小时后重置`;
    const days = Math.floor(hrs / 24);
    const remH = hrs % 24;
    return remH ? `${days} 天 ${remH} 小时后重置` : `${days} 天后重置`;
  };

  const fmtSec = (s) => {
    if (s == null || !Number.isFinite(s) || s < 0) return "—";
    if (s >= 100) return `${Math.round(s)}s`;
    if (s >= 10) return `${s.toFixed(2).replace(/\.?0+$/, "")}s`;
    return `${s.toFixed(2)}s`;
  };

  const parseTs = (v) => {
    if (v == null) return null;
    if (typeof v === "number") return Number.isFinite(v) ? v : null;
    if (typeof v === "string") {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : null;
    }
    if (typeof v === "object") {
      if (typeof v.epochMillis === "number") return v.epochMillis;
      if (typeof v.toISOString === "function") return Date.parse(v.toISOString());
    }
    return null;
  };

  const fmtCost = (cost) => {
    if (!cost || typeof cost.amount !== "number" || !Number.isFinite(cost.amount)) return null;
    const cur = (cost.currency || "USD").toUpperCase();
    const sym = cur === "USD" ? "$" : cur === "CNY" ? "¥" : cur === "EUR" ? "€" : "";
    const suf = sym ? "" : ` ${cur}`;
    if (cost.amount > 0 && cost.amount < 0.01) return `<${sym}0.01${suf}`;
    return `${sym}${cost.amount.toFixed(2)}${suf}`;
  };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function readTelemetry() {
    const col = document.querySelector("[data-chat-column]");
    if (!col) return null;
    const fk = Object.keys(col).find((k) => k.startsWith("__reactFiber$"));
    if (!fk) return null;
    let f = col[fk];
    let contextWindow = null;
    let providers = null;
    let sources = null;
    let providerTurns = null;
    let runs = null;
    let turnItems = null;
    let providerInstanceId = null;
    let model = null;

    for (let step = 0; step < 18 && f; step++, f = f.return) {
      const data = f.updateQueue?.memoCache?.data;
      if (!Array.isArray(data)) continue;
      for (const chunk of data) {
        if (!Array.isArray(chunk)) continue;
        for (let i = 0; i < chunk.length; i++) {
          const v = chunk[i];
          if (!v || typeof v !== "object") continue;
          if (!contextWindow && "usedTokens" in v && "usedPercentage" in v) {
            contextWindow = v;
          } else if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === "object") {
            if (!providers && "instanceId" in v[0] && "driver" in v[0]) providers = v;
            else if (!sources && "accounts" in v[0] && Array.isArray(v[0].accounts)) sources = v;
            else if (!providerTurns && "providerThreadId" in v[0] && "runAttemptId" in v[0] && "ordinal" in v[0]) {
              providerTurns = v;
            }
          } else if (v.props?.usage && typeof v.props.usage === "object") {
            const u = v.props.usage;
            if (u.providerInstanceId) providerInstanceId = u.providerInstanceId;
            if (u.model) model = u.model;
            if (u.contextWindow) contextWindow = u.contextWindow;
            if (Array.isArray(u.providers)) providers = u.providers;
            if (Array.isArray(u.sources)) sources = u.sources;
          } else if ("providerTurns" in v && Array.isArray(v.providerTurns)) {
            if (!providerTurns) providerTurns = v.providerTurns;
            if (!runs && Array.isArray(v.runs)) runs = v.runs;
            if (!turnItems && Array.isArray(v.turnItems)) turnItems = v.turnItems;
          } else if ("usageLimitSources" in v && Array.isArray(v.usageLimitSources) && !sources) {
            sources = v.usageLimitSources;
          } else if (!providerInstanceId && "providerInstanceId" in v && "model" in v && typeof v.providerInstanceId === "string") {
            providerInstanceId = v.providerInstanceId;
            if (typeof v.model === "string") model = v.model;
          }
        }
      }
      if (contextWindow && providers && providerTurns && runs) break;
    }

    // Fallback: infer active provider from composer model button aria-label if not directly captured
    if (!providerInstanceId && providers) {
      const modelBtn = document.querySelector('[data-chat-composer-footer] button[data-slot="popover-trigger"]');
      const aria = (modelBtn?.getAttribute("aria-label") || modelBtn?.textContent || "").toLowerCase();
      if (/gemini|neon|agy|antigravity/.test(aria)) providerInstanceId = "antigravity";
      else if (/claude|sonnet|opus|haiku/.test(aria)) providerInstanceId = "claudeAgent";
      else if (/gpt|codex|o[134]|sol|terra/.test(aria)) providerInstanceId = "codex";
      else if (/cursor/.test(aria)) providerInstanceId = "cursor";
      else if (/grok/.test(aria)) providerInstanceId = "grok";
    }

    return {
      contextWindow,
      providers: providers || [],
      sources: sources || [],
      providerTurns: providerTurns || [],
      runs: runs || [],
      turnItems: turnItems || [],
      providerInstanceId,
      model,
    };
  }

  function pctTone(pct, isCache = false) {
    if (pct == null) return "na";
    if (isCache) return pct >= 85 ? "ok" : pct >= 60 ? "mid" : pct >= 35 ? "warn" : "danger";
    return pct >= 85 ? "danger" : pct >= 70 ? "warn" : pct >= 45 ? "mid" : "normal";
  }

  function pickQuotaGroups(raw) {
    const { providers, sources, providerInstanceId } = raw;
    let prov =
      providers.find((p) => p.instanceId === providerInstanceId) ||
      providers.find((p) => p.driver === providerInstanceId) ||
      providers.find((p) => (p.usageLimits?.windows?.length || 0) > 0) ||
      null;

    let driver = prov?.driver || providerInstanceId || "";
    let windows = prov?.usageLimits?.windows ? [...prov.usageLimits.windows] : [];
    let unavailable = prov?.usageLimits?.unavailable || null;

    // Fallback to usageLimitSources (hub/pool accounts) when local provider has no windows
    if (windows.length === 0 && sources.length > 0 && driver) {
      const matched = sources
        .flatMap((s) => s.accounts || [])
        .filter((a) => a.driver === driver && (a.usageLimits?.windows?.length || 0) > 0);
      if (matched.length > 0) {
        windows = [...matched[0].usageLimits.windows];
        unavailable = null;
      }
    }

    if (windows.length === 0) {
      return { driver, groups: [], unavailable };
    }

    const normPct = (w) => (w && typeof w.usedPercent === "number" ? Math.round(Math.min(100, Math.max(0, w.usedPercent))) : null);

    // Antigravity: up to 2 dual-ring groups (e.g. gemini + 3p/claude/gpt), each with 5h + weekly.
    // When weekly is exhausted (>= 100%), its paired 5h window shows no value.
    if (driver === "antigravity") {
      const map = new Map();
      for (const w of windows) {
        const base = (w.id || w.label || "default").replace(/-(5h|weekly|quota|session)$/i, "");
        if (!map.has(base)) map.set(base, { key: base, session: null, weekly: null, other: [] });
        const g = map.get(base);
        if (w.kind === "session" || /5h/i.test(w.id || "")) g.session = w;
        else if (w.kind === "weekly" || /weekly|7d/i.test(w.id || "")) g.weekly = w;
        else g.other.push(w);
      }
      const sorted = [...map.values()]
        .sort((a, b) => Number(!/^gemini/i.test(a.key)) - Number(!/^gemini/i.test(b.key)) || a.key.localeCompare(b.key))
        .slice(0, 2);

      const groups = sorted.map((g) => {
        const wPct = normPct(g.weekly);
        const weeklyExhausted = wPct !== null && wPct >= 100;
        const sPct = weeklyExhausted ? null : normPct(g.session);
        const tag = /^gemini/i.test(g.key) ? "G" : /^3p/i.test(g.key) ? "3P" : g.key.slice(0, 2).toUpperCase();
        return {
          mode: "dual",
          tag,
          label: g.key,
          session: g.session,
          weekly: g.weekly,
          sessionPct: sPct,
          weeklyPct: wPct,
          weeklyExhausted,
        };
      });
      return { driver, groups, unavailable: null };
    }

    // Standard providers: session (5h) + weekly -> dual ring; weekly only -> single ring; other -> single ring.
    const session = windows.find((w) => w.kind === "session" || /5h|five/i.test(w.id || ""));
    const weekly = windows.find((w) => w.kind === "weekly" || /week|7d/i.test(w.id || ""));
    if (session && weekly) {
      const wPct = normPct(weekly);
      const weeklyExhausted = wPct !== null && wPct >= 100;
      const sPct = weeklyExhausted ? null : normPct(session);
      return {
        driver,
        groups: [{ mode: "dual", tag: "", label: driver || "Quota", session, weekly, sessionPct: sPct, weeklyPct: wPct, weeklyExhausted }],
        unavailable: null,
      };
    }
    const single = weekly || session || windows[0];
    return {
      driver,
      groups: [{ mode: "single", tag: "", label: single.label || driver || "Quota", single, pct: normPct(single) }],
      unavailable: null,
    };
  }

  function summarizeSessionSpend(raw) {
    const turns = raw?.providerTurns || [];
    const cw = raw?.contextWindow || null;
    let countedTurns = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cachedInputTokens = 0;
    let hasCached = false;
    let cacheCreationTokens = 0;
    let hasCacheWrite = false;
    let reasoningTokens = 0;
    let hasReasoning = false;
    let latestTurnUsage = null;

    for (const t of turns) {
      const u = t?.turnTokenUsage;
      if (!u || u.usageStatus === "unavailable" || typeof u.inputTokens !== "number") continue;
      countedTurns++;
      inputTokens += u.inputTokens;
      outputTokens += typeof u.outputTokens === "number" ? u.outputTokens : 0;
      if (typeof u.cachedInputTokens === "number") {
        cachedInputTokens += u.cachedInputTokens;
        hasCached = true;
      }
      if (typeof u.cacheCreationTokens === "number") {
        cacheCreationTokens += u.cacheCreationTokens;
        hasCacheWrite = true;
      }
      if (typeof u.reasoningTokens === "number") {
        reasoningTokens += u.reasoningTokens;
        hasReasoning = true;
      }
      latestTurnUsage = u;
    }

    let totalTokens = null;
    let source = "暂无";
    if (countedTurns > 0) {
      totalTokens = inputTokens + outputTokens;
      source = `共 ${countedTurns} 轮累计`;
    } else if (cw) {
      if (typeof cw.totalProcessedTokens === "number" && cw.totalProcessedTokens > 0) {
        totalTokens = cw.totalProcessedTokens;
        source = "会话总计";
      } else if (typeof cw.inputTokens === "number" || typeof cw.outputTokens === "number") {
        inputTokens = cw.inputTokens ?? 0;
        outputTokens = cw.outputTokens ?? 0;
        totalTokens = inputTokens + outputTokens;
        if (typeof cw.cachedInputTokens === "number") {
          cachedInputTokens = cw.cachedInputTokens;
          hasCached = true;
        }
        if (typeof cw.reasoningOutputTokens === "number") {
          reasoningTokens = cw.reasoningOutputTokens;
          hasReasoning = true;
        }
        source = "会话累计";
      } else if (typeof cw.usedTokens === "number" && cw.usedTokens > 0) {
        totalTokens = cw.usedTokens;
        source = "当前上下文";
      }
    }

    const cost = cw?.cost && typeof cw.cost.amount === "number" ? cw.cost : null;
    return {
      totalTokens,
      inputTokens: countedTurns > 0 || cw?.inputTokens != null ? inputTokens : null,
      outputTokens: countedTurns > 0 || cw?.outputTokens != null ? outputTokens : null,
      cachedInputTokens: hasCached ? cachedInputTokens : null,
      cacheCreationTokens: hasCacheWrite ? cacheCreationTokens : null,
      reasoningTokens: hasReasoning ? reasoningTokens : null,
      countedTurns,
      source,
      cost,
      latestTurnUsage,
    };
  }

  function summarizeRunMetrics(raw, spend) {
    const runs = raw?.runs || [];
    const turns = raw?.providerTurns || [];
    const items = raw?.turnItems || [];
    const cw = raw?.contextWindow || null;

    const latestRun = runs.length > 0 ? runs[runs.length - 1] : null;
    const latestTurn = turns.length > 0 ? turns[turns.length - 1] : null;
    const totalRuns = runs.length || (turns.length > 0 ? turns.length : 0);
    const turnIndex = latestRun?.ordinal || totalRuns || null;

    const runItems = latestRun ? items.filter((it) => it?.runId === latestRun.id) : items;
    const stepCount = runItems.length || cw?.toolUses || null;
    const totalCalls = items.length || cw?.toolUses || null;

    const startMs = parseTs(latestRun?.startedAt ?? latestRun?.requestedAt ?? latestTurn?.startedAt);
    const endMs = parseTs(latestRun?.completedAt ?? latestTurn?.completedAt);
    const durationSec =
      startMs != null && endMs != null && endMs >= startMs
        ? (endMs - startMs) / 1000
        : cw?.durationMs != null && cw.durationMs > 0
          ? cw.durationMs / 1000
          : null;

    let firstItemMs = null;
    if (startMs != null && runItems.length > 0) {
      for (const it of runItems) {
        const ts = parseTs(it?.startedAt ?? it?.createdAt);
        if (ts != null && ts >= startMs && (firstItemMs === null || ts < firstItemMs)) firstItemMs = ts;
      }
    }
    const ttftSec = startMs != null && firstItemMs != null && firstItemMs > startMs ? (firstItemMs - startMs) / 1000 : null;
    const streamSec =
      ttftSec != null && durationSec != null && durationSec > ttftSec + 0.05 ? durationSec - ttftSec : null;

    const lt = spend.latestTurnUsage;
    const lastOut = lt?.outputTokens ?? cw?.lastOutputTokens ?? (totalRuns <= 1 ? cw?.outputTokens : null) ?? null;
    const lastReason =
      lt?.reasoningTokens ?? cw?.lastReasoningOutputTokens ?? (totalRuns <= 1 ? cw?.reasoningOutputTokens : null) ?? null;
    const lastIn = lt?.inputTokens ?? cw?.lastInputTokens ?? (totalRuns <= 1 ? cw?.inputTokens : null) ?? null;
    const turnDelta =
      lastIn != null || lastOut != null ? (lastIn ?? 0) + (lastOut ?? 0) : cw?.lastUsedTokens ?? null;

    const e2eTps = lastOut != null && lastOut > 0 && durationSec != null && durationSec > 0.1 ? lastOut / durationSec : null;
    const streamTps = lastOut != null && lastOut > 0 && streamSec != null && streamSec > 0.1 ? lastOut / streamSec : null;

    let thinkPct = null;
    let bodyPct = null;
    if (lastOut != null && lastOut > 0 && lastReason != null) {
      thinkPct = Math.round(Math.min(100, Math.max(0, (lastReason / lastOut) * 100)));
      bodyPct = 100 - thinkPct;
    }

    return {
      turnIndex,
      totalRuns,
      stepCount,
      totalCalls,
      durationSec,
      ttftSec,
      streamSec,
      e2eTps,
      streamTps,
      turnDelta,
      thinkPct,
      bodyPct,
    };
  }

  function buildTelemetryModel(raw) {
    const cw = raw?.contextWindow || null;
    const spend = summarizeSessionSpend(raw);
    const metrics = summarizeRunMetrics(raw, spend);

    // Cache hit: prefer last turn (contextWindow.last* or latest providerTurn.turnTokenUsage), fall back to cumulative
    let cachePct = null;
    let cachePctExact = null;
    let cacheScope = "暂无";
    let lastPct = null;
    let lastPctExact = null;
    let totalPct = null;
    let totalPctExact = null;
    const lt = spend.latestTurnUsage;
    if (cw && cw.lastInputTokens > 0 && cw.lastCachedInputTokens != null) {
      const r = Math.min(100, Math.max(0, (cw.lastCachedInputTokens / cw.lastInputTokens) * 100));
      lastPct = Math.round(r);
      lastPctExact = Number(r.toFixed(1));
    } else if (lt && lt.inputTokens > 0 && lt.cachedInputTokens != null) {
      const r = Math.min(100, Math.max(0, (lt.cachedInputTokens / lt.inputTokens) * 100));
      lastPct = Math.round(r);
      lastPctExact = Number(r.toFixed(1));
    }
    if (cw && cw.inputTokens > 0 && cw.cachedInputTokens != null) {
      const r = Math.min(100, Math.max(0, (cw.cachedInputTokens / cw.inputTokens) * 100));
      totalPct = Math.round(r);
      totalPctExact = Number(r.toFixed(1));
    } else if (spend.inputTokens > 0 && spend.cachedInputTokens != null) {
      const r = Math.min(100, Math.max(0, (spend.cachedInputTokens / spend.inputTokens) * 100));
      totalPct = Math.round(r);
      totalPctExact = Number(r.toFixed(1));
    }
    if (lastPct !== null) {
      cachePct = lastPct;
      cachePctExact = lastPctExact;
      cacheScope = "最近一轮";
    } else if (totalPct !== null) {
      cachePct = totalPct;
      cachePctExact = totalPctExact;
      cacheScope = "会话累计";
    }

    // Context window (apply a 400k soft cap display warning for Antigravity since agy lacks native cap config)
    const quota = raw ? pickQuotaGroups(raw) : { driver: "", groups: [], unavailable: null };
    const isAgy = quota.driver === "antigravity" || raw?.providerInstanceId === "antigravity";
    const AGY_SOFT_CAP = 400_000;
    let ctxPct = null;
    let softCap = null;
    if (cw) {
      if (isAgy && typeof cw.usedTokens === "number" && (cw.maxTokens == null || cw.maxTokens > AGY_SOFT_CAP)) {
        softCap = AGY_SOFT_CAP;
        ctxPct = Math.round(Math.min(100, Math.max(0, (cw.usedTokens / AGY_SOFT_CAP) * 100)));
      } else if (typeof cw.usedPercentage === "number") {
        ctxPct = Math.round(Math.min(100, Math.max(0, cw.usedPercentage)));
      } else if (cw.maxTokens > 0 && typeof cw.usedTokens === "number") {
        ctxPct = Math.round(Math.min(100, Math.max(0, (cw.usedTokens / cw.maxTokens) * 100)));
      }
    }

    return {
      cache: { pct: cachePct, pctExact: cachePctExact, scope: cacheScope, lastPct, lastPctExact, totalPct, totalPctExact, cw, lt },
      ctx: { pct: ctxPct, cw, softCap },
      quota,
      spend,
      metrics,
    };
  }

  function singleRingSvg(pct, tone, baseColor = "ctx") {
    const r = 5.8;
    const c = 2 * Math.PI * r;
    const off = pct == null ? c : c * (1 - pct / 100);
    const arcTone = tone === "danger" || tone === "warn" ? tone : tone === "mid" ? `${baseColor}-mid` : baseColor;
    return `<svg class="t3p-ring" viewBox="0 0 16 16" aria-hidden="true"><circle class="trk" cx="8" cy="8" r="${r}"/>${pct != null ? `<circle class="arc" data-tone="${arcTone}" cx="8" cy="8" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>` : ""}</svg>`;
  }

  function dualRingSvg(outerPct, innerPct) {
    const rOut = 7.2;
    const rIn = 4.4;
    const cOut = 2 * Math.PI * rOut;
    const cIn = 2 * Math.PI * rIn;
    const offOut = outerPct == null ? cOut : cOut * (1 - outerPct / 100);
    const offIn = innerPct == null ? cIn : cIn * (1 - innerPct / 100);
    const mapArc = (p, base) => {
      if (p == null) return base;
      const t = pctTone(p);
      return t === "danger" || t === "warn" ? t : t === "mid" ? "quota-mid" : base;
    };
    const tOut = mapArc(outerPct, "quota");
    const tIn = mapArc(innerPct, "quota-in");
    return `<svg class="t3p-ring dual" viewBox="0 0 18 18" aria-hidden="true">` +
      `<circle class="trk" cx="9" cy="9" r="${rOut}"/>` +
      (outerPct != null ? `<circle class="arc" data-tone="${tOut}" cx="9" cy="9" r="${rOut}" stroke-dasharray="${cOut.toFixed(2)}" stroke-dashoffset="${offOut.toFixed(2)}"/>` : "") +
      `<circle class="trk" cx="9" cy="9" r="${rIn}"/>` +
      (innerPct != null ? `<circle class="arc" data-tone="${tIn}" cx="9" cy="9" r="${rIn}" stroke-dasharray="${cIn.toFixed(2)}" stroke-dashoffset="${offIn.toFixed(2)}"/>` : "") +
      `</svg>`;
  }

  function ensureTelemetryEls() {
    if (!telBar) {
      telBar = document.createElement("div");
      telBar.id = "t3p-telemetry";
      telBar.addEventListener("click", (e) => {
        const b = e.target.closest?.(".t3p-tel-btn");
        if (!b) return;
        e.stopPropagation();
        const kind = b.dataset.kind;
        telOpenKind = telOpenKind === kind ? null : kind;
        renderTelPopover(b);
      });
    }
    if (!telPop) {
      telPop = document.createElement("div");
      telPop.id = "t3p-tel-pop";
      telPop.addEventListener("click", (e) => e.stopPropagation());
      document.addEventListener("click", () => {
        if (telOpenKind) {
          telOpenKind = null;
          renderTelPopover(null);
        }
      });
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && telOpenKind) {
          telOpenKind = null;
          renderTelPopover(null);
        }
      });
    }
    if (!telPop.isConnected && document.body) document.body.appendChild(telPop);
  }

  function mountTelemetry() {
    const stack = document.querySelector("[data-chat-composer-stack]");
    const shell = stack?.querySelector('[data-slot="composer-shell"]');
    if (!stack || !shell) return false;
    ensureTelemetryEls();

    // Mount inside T3's bottom metadata row, placed right before the branch control so branch stays rightmost with full name
    const branchBtn = stack.querySelector('button[aria-label*="分支"], button[aria-label*="Branch"], button[aria-label*="branch"]');
    let metaRow = null;
    let branchSlot = null;
    if (branchBtn) {
      let cur = branchBtn.parentElement;
      let prev = branchBtn;
      for (let i = 0; i < 4 && cur && stack.contains(cur); i++, prev = cur, cur = cur.parentElement) {
        if (cur === shell || cur.contains(shell)) break;
        const st = getComputedStyle(cur);
        if (st.display.includes("flex") && st.flexDirection !== "column" && cur.getBoundingClientRect().width > 240) {
          metaRow = cur;
          branchSlot = prev;
        }
      }
    }

    if (metaRow) {
      if (telHostFallback?.isConnected) telHostFallback.remove();
      if (branchSlot && branchSlot.parentElement === metaRow) {
        branchSlot.setAttribute("data-t3p-branch-slot", "");
        if (telBar.parentElement !== metaRow || telBar.nextElementSibling !== branchSlot) {
          metaRow.insertBefore(telBar, branchSlot);
        }
      } else if (telBar.parentElement !== metaRow) {
        metaRow.appendChild(telBar);
      }
      return true;
    }

    // Fallback: dedicated compact row right below composer-shell
    if (!telHostFallback) {
      telHostFallback = document.createElement("div");
      telHostFallback.className = "t3p-tel-host";
    }
    if (telHostFallback.parentElement !== shell.parentElement) {
      shell.insertAdjacentElement("afterend", telHostFallback);
    }
    if (telBar.parentElement !== telHostFallback) {
      telHostFallback.appendChild(telBar);
    }
    return true;
  }

  function quotaRemainRingSvg(remainPct) {
    const r = 7;
    const c = 2 * Math.PI * r;
    const off = remainPct == null ? c : c * (1 - remainPct / 100);
    const tone = remainPct == null ? "normal" : remainPct <= 10 ? "danger" : remainPct <= 20 ? "warn" : "normal";
    return `<svg class="pq-ring" viewBox="0 0 18 18" aria-hidden="true"><circle class="trk" cx="9" cy="9" r="${r}"/>${remainPct != null ? `<circle class="arc" data-tone="${tone}" cx="9" cy="9" r="${r}" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${off.toFixed(2)}"/>` : ""}</svg>`;
  }

  function renderTelPopover(anchorBtn) {
    if (!telPop) return;
    if (!telOpenKind || !lastTelData) {
      telPop.removeAttribute("data-open");
      telBar?.querySelectorAll(".t3p-tel-btn[data-open]").forEach((x) => x.removeAttribute("data-open"));
      return;
    }
    const btn = anchorBtn || telBar?.querySelector(`.t3p-tel-btn[data-kind="${telOpenKind}"]`);
    if (!btn) {
      telPop.removeAttribute("data-open");
      return;
    }
    telBar?.querySelectorAll(".t3p-tel-btn").forEach((x) => toggle(x, "data-open", x === btn));

    const d = lastTelData;
    let htmlStr = "";
    if (telOpenKind === "quota") {
      const q = d.quota;
      const groupTitle = (g) => {
        if (/^gemini/i.test(g.label || "")) return "Gemini 模型";
        if (/^(3p|claude|gpt)/i.test(g.label || "")) return "Claude 与 GPT 模型";
        if (q.driver === "codex") return "Codex 模型";
        if (q.driver === "claudeAgent") return "Claude 模型";
        return g.label || q.driver || "当前模型";
      };
      const rowHtml = (name, resetStr, usedPct, exhaustedNote) => {
        if (exhaustedNote) {
          return `<div class="pq-row"><div class="pq-left"><span class="pq-name">${esc(name)}</span><span class="pq-reset">${esc(exhaustedNote)}</span></div><div class="pq-right"><span>—</span>${quotaRemainRingSvg(null)}</div></div>`;
        }
        const remain = usedPct != null ? Math.max(0, 100 - usedPct) : null;
        return `<div class="pq-row"><div class="pq-left"><span class="pq-name">${esc(name)}</span>${resetStr ? `<span class="pq-reset">${esc(resetStr)}</span>` : ""}</div><div class="pq-right"><span>${remain != null ? `${remain}% 剩余` : "—"}</span>${quotaRemainRingSvg(remain)}</div></div>`;
      };

      if (q.groups.length === 0) {
        htmlStr =
          `<div class="psec"><b>用量</b><small>${esc(q.driver || "当前模型")}</small></div><div class="phr"></div>` +
          `<div class="pr"><span>状态</span><b>${esc(q.unavailable?.message || "当前服务商未上报额度")}</b></div>`;
      } else {
        const blocks = q.groups.map((g) => {
          const rows = [];
          if (g.mode === "dual") {
            rows.push(rowHtml("每周限额", fmtReset(g.weekly?.resetsAt), g.weeklyPct, null));
            rows.push(
              rowHtml(
                "5 小时限额",
                fmtReset(g.session?.resetsAt),
                g.sessionPct,
                g.weeklyExhausted ? "每周限额已耗尽" : null,
              ),
            );
          } else {
            const label = g.single?.kind === "weekly" ? "每周限额" : g.single?.kind === "session" ? "5 小时限额" : g.label || "用量限额";
            rows.push(rowHtml(label, fmtReset(g.single?.resetsAt), g.pct, null));
          }
          return `<div class="pq-group"><div class="pq-gtitle">${esc(groupTitle(g))}</div>${rows.join("")}</div>`;
        });
        htmlStr = `<div class="psec"><b>用量</b><small>${esc(q.driver || "")}</small></div><div class="phr"></div>${blocks.join('<div class="phr"></div>')}`;
      }
    } else {
      // Rich two-section session telemetry panel (cache / ctx / spend all open this unified detail view)
      const m = d.metrics;
      const cw = d.ctx.cw;
      const sp = d.spend;
      const headRightParts = [];
      if (m.turnIndex) headRightParts.push(`第${m.turnIndex}轮`);
      if (m.stepCount) headRightParts.push(`总${m.stepCount}步`);
      if (m.durationSec != null) headRightParts.push(`共耗时${fmtSec(m.durationSec)}`);

      const turnRows = [];
      if (m.streamTps != null || m.e2eTps != null) {
        const spParts = [];
        if (m.streamTps != null) spParts.push(`流式 ${m.streamTps.toFixed(1)} tok/s`);
        if (m.e2eTps != null) spParts.push(`端到端 ${m.e2eTps.toFixed(1)} tok/s`);
        turnRows.push(`<div class="pr"><span>生成速度</span><b>${spParts.join('<span class="dim">|</span>')}</b></div>`);
      }
      if (m.ttftSec != null || m.streamSec != null || m.durationSec != null) {
        const tParts = [];
        if (m.ttftSec != null) tParts.push(`首响 ${fmtSec(m.ttftSec)}`);
        if (m.streamSec != null) tParts.push(`流式 ${fmtSec(m.streamSec)}`);
        if (m.durationSec != null) tParts.push(`总计 ${fmtSec(m.durationSec)}`);
        turnRows.push(`<div class="pr"><span>响应耗时</span><b>${tParts.join('<span class="dim">|</span>')}</b></div>`);
      }
      if (m.turnDelta != null || d.cache.pctExact != null) {
        const cacheTone = pctTone(d.cache.pct, true);
        const pill =
          d.cache.pctExact != null
            ? `<span class="ppill" data-tone="${cacheTone}">缓存率 ${d.cache.pctExact}%</span>`
            : "";
        turnRows.push(
          `<div class="pr"><span>本轮净增</span><b>${m.turnDelta != null ? `+${fmtTokens(m.turnDelta)}` : "—"}${pill}</b></div>`,
        );
      }
      if (m.thinkPct != null && m.bodyPct != null) {
        turnRows.push(
          `<div class="pr"><span>输出比例</span><span class="psplit">` +
            `<span style="color:var(--t3p-pop-orange);font-weight:600">思维链 ${m.thinkPct}%</span>` +
            `<span class="psplit-bar"><span class="psplit-think" style="width:${m.thinkPct}%"></span><span class="psplit-body" style="width:${m.bodyPct}%"></span></span>` +
            `<span style="color:var(--t3p-pop-blue);font-weight:600">正文 ${m.bodyPct}%</span>` +
          `</span></div>`,
        );
      }
      if (turnRows.length === 0) {
        turnRows.push(`<div class="pr"><span>状态</span><b>首轮回复完成后显示详细指标</b></div>`);
      }

      const sessRight = [];
      if (m.totalRuns) sessRight.push(`${m.totalRuns} 轮提问`);
      if (m.totalCalls) sessRight.push(`${m.totalCalls} 次调用`);

      const ctxTone = pctTone(d.ctx.pct, false);
      const ctxBarW = d.ctx.pct ?? 0;
      const ctxText = cw
        ? d.ctx.softCap
          ? `${fmtTokens(cw.usedTokens)}/${fmtTokens(d.ctx.softCap)} (${d.ctx.pct ?? 0}% · 软上限)`
          : cw.maxTokens
            ? `${fmtTokens(cw.usedTokens)}/${fmtTokens(cw.maxTokens)} (${d.ctx.pct ?? 0}%)`
            : fmtTokens(cw.usedTokens)
        : "—";
      const avgCache = d.cache.totalPctExact != null ? `全轮次平均缓存 <b style="color:var(--t3p-pop-green)">${d.cache.totalPctExact}%</b>` : "";

      const footParts = [];
      if (sp.totalTokens != null) footParts.push(`累计消耗 ${fmtTokens(sp.totalTokens)}`);
      if (sp.inputTokens != null) footParts.push(`输入 ${fmtTokens(sp.inputTokens)}`);
      if (sp.cachedInputTokens != null) footParts.push(`缓存读 ${fmtTokens(sp.cachedInputTokens)}`);
      if (sp.outputTokens != null) footParts.push(`输出 ${fmtTokens(sp.outputTokens)}`);
      const costStr = fmtCost(sp.cost);
      if (costStr) footParts.push(`花费 ${costStr}`);

      htmlStr =
        `<div class="psec"><b>当前轮次</b><small>${esc(headRightParts.join("  ") || d.cache.scope)}</small></div>` +
        `<div class="phr"></div>` +
        turnRows.join("") +
        `<div class="psec" style="margin-top:2px"><b>会话总计</b><small>${esc(sessRight.join(" / ") || sp.source)}</small></div>` +
        `<div class="phr"></div>` +
        `<div class="pctx-row"><div class="pb"><i data-tone="${ctxTone}" style="width:${ctxBarW}%"></i></div><b style="color:${ctxTone === "danger" ? "var(--t3p-pop-danger)" : ctxTone === "warn" ? "var(--t3p-pop-warn)" : "var(--foreground)"}">${esc(ctxText)}</b></div>` +
        (avgCache ? `<div class="pr"><span></span><span>${avgCache}</span></div>` : "") +
        `<div class="pf"><span>${esc(footParts.join(" · ") || "暂无累计消耗")}</span>${!costStr ? "<span>花费 —</span>" : ""}</div>`;
    }

    telPop.innerHTML = htmlStr;
    telPop.setAttribute("data-open", "");
    const r = btn.getBoundingClientRect();
    const popW = Math.min(352, window.innerWidth - 20);
    const left = Math.max(10, Math.min(window.innerWidth - popW - 10, r.right - popW));
    const bottom = Math.max(10, window.innerHeight - r.top + 8);
    setVar(telPop, "left", `${Math.round(left)}px`);
    setVar(telPop, "bottom", `${Math.round(bottom)}px`);
  }

  function renderTelemetry(model) {
    const cacheTone = pctTone(model.cache.pct, true);
    const cacheText = model.cache.pct != null ? `${model.cache.pct}%` : "—";

    const ctxTone = pctTone(model.ctx.pct, false);
    const ctxText = model.ctx.pct != null ? `${model.ctx.pct}%` : "—";

    let quotaHtml = "";
    let quotaTone = "na";
    if (model.quota.groups.length === 0) {
      quotaHtml = `${singleRingSvg(null, "na", "quota")}<span class="val">—</span>`;
    } else {
      const parts = [];
      let worst = 0;
      for (const g of model.quota.groups) {
        if (g.mode === "dual") {
          const sTxt = g.weeklyExhausted ? "—" : g.sessionPct != null ? `${g.sessionPct}%` : "—";
          const wTxt = g.weeklyPct != null ? `${g.weeklyPct}%` : "—";
          const gWorst = Math.max(g.weeklyPct ?? 0, g.sessionPct ?? 0);
          const gTone = pctTone(gWorst);
          worst = Math.max(worst, gWorst);
          parts.push(
            `<span class="t3p-qgroup" data-tone="${gTone}">${g.tag ? `<span class="t3p-qtag">${esc(g.tag)}</span>` : ""}${dualRingSvg(g.sessionPct, g.weeklyPct)}<span class="val">${sTxt}/${wTxt}</span></span>`,
          );
        } else {
          const gTone = pctTone(g.pct);
          worst = Math.max(worst, g.pct ?? 0);
          parts.push(
            `<span class="t3p-qgroup" data-tone="${gTone}">${singleRingSvg(g.pct, gTone, "quota")}<span class="val">${g.pct != null ? `${g.pct}%` : "—"}</span></span>`,
          );
        }
      }
      quotaTone = pctTone(worst);
      quotaHtml = parts.join("");
    }

    const spendTok = fmtTokens(model.spend.totalTokens);
    const spendCost = fmtCost(model.spend.cost);
    const spendTone = model.spend.totalTokens != null || spendCost != null ? "normal" : "na";
    const spendHtml =
      model.spend.totalTokens != null && spendCost != null
        ? `<span class="val">Σ ${esc(spendTok)}<span class="sep">·</span>${esc(spendCost)}</span>`
        : model.spend.totalTokens != null
          ? `<span class="val">Σ ${esc(spendTok)}</span>`
          : spendCost != null
            ? `<span class="val">${esc(spendCost)}</span>`
            : `<span class="val">Σ —</span>`;

    const sig = `${cacheText}|${cacheTone}|${ctxText}|${ctxTone}|${quotaTone}|${quotaHtml}|${spendTone}|${spendHtml}`;
    lastTelData = model;
    if (sig !== lastTelSig) {
      lastTelSig = sig;
      telBar.innerHTML =
        `<button type="button" class="t3p-tel-btn" data-kind="cache" data-tone="${cacheTone}" title="会话缓存命中（${esc(model.cache.scope)}），点击查看详情">` +
        `<span class="t3p-tel-dot"></span><span class="val">${cacheText}</span></button>` +
        `<button type="button" class="t3p-tel-btn" data-kind="ctx" data-tone="${ctxTone}" title="上下文使用率，点击查看详情">` +
        `${singleRingSvg(model.ctx.pct, ctxTone, "ctx")}<span class="val">${ctxText}</span></button>` +
        `<button type="button" class="t3p-tel-btn" data-kind="quota" data-tone="${quotaTone}" title="额度使用率，点击查看详情">` +
        `${quotaHtml}</button>` +
        `<button type="button" class="t3p-tel-btn" data-kind="spend" data-tone="${spendTone}" title="当前会话累计消耗 Token 与花费金额，点击查看明细">` +
        `${spendHtml}</button>`;
    }
    if (telOpenKind) renderTelPopover(null);
  }

  function syncTelemetry() {
    if (!mountTelemetry()) return;
    const raw = readTelemetry();
    const model = buildTelemetryModel(raw);
    renderTelemetry(model);
  }

  function ensureButton(host) {
    if (!btn) {
      btnWrap = document.createElement("span");
      btnWrap.className = "flex shrink-0";
      btnWrap.setAttribute("data-t3p-btn-wrap", "");
      btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-slot", "toggle");
      btn.setAttribute("aria-label", "竖屏布局");
      btn.innerHTML = ICON;
      btn.addEventListener("click", () => {
        if (broken) return;
        state.on = !state.on;
        save();
        sync();
      });
      btnWrap.appendChild(btn);
    }
    if (host && btnWrap.parentElement !== host) {
      const native = host.querySelector('button[data-slot="toggle"]');
      btn.className = native ? native.className : FALLBACK_BTN_CLASS;
      host.prepend(btnWrap);
    }
  }

  function updateButton() {
    if (!btn) return;
    const pressed = state.on && !broken;
    btn.setAttribute("aria-pressed", String(pressed));
    btn.toggleAttribute("data-pressed", pressed);
    btn.setAttribute("aria-disabled", String(broken));
    btn.title = broken ? TITLE_BROKEN : state.on ? TITLE_ON : TITLE_OFF;
  }

  function setAttr(name, value) {
    if (value == null) {
      if (html().hasAttribute(name)) html().removeAttribute(name);
    } else if (html().getAttribute(name) !== value) html().setAttribute(name, value);
  }

  function mark(el, part) {
    if (el && el.getAttribute("data-t3p-part") !== part) el.setAttribute("data-t3p-part", part);
  }

  // Tags the parts of T3's sidebar that the stylesheet arranges. Returns false when one is missing.
  function markParts(inner) {
    const foot = inner.querySelector('[data-slot="sidebar-footer"]');
    const wrap = foot?.parentElement;
    if (!wrap || !inner.contains(wrap)) return false;
    let head = null;
    let list = null;
    let search = null;
    for (const child of wrap.children) {
      if (child.querySelector('[data-slot="sidebar-content"]')) list = child;
      else if (child.querySelector('input[data-slot="input"]')) search = child;
      else if (child !== foot && !head) head = child;
    }
    const nav = head?.querySelector('button[data-slot="tooltip-trigger"]:not([data-sidebar])')?.parentElement;
    if (!head || !list || !search || !nav) return false;
    mark(wrap, "wrap");
    mark(head, "head");
    mark(list, "list");
    mark(search, "search");
    mark(foot, "foot");
    mark(nav, "nav");
    const threads = list.querySelector('[data-slot="sidebar-content"] > [data-slot="sidebar-group"] > ul');
    if (threads) mark(threads, "threads");
    for (const card of list.querySelectorAll('[data-testid="sidebar-row-card"] > div')) {
      const rows = card.children;
      if (rows.length === 3 && rows[0].children.length === 3) mark(card, "card");
    }
    return true;
  }

  function setVar(el, name, value) {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
  }
  function toggle(el, name, on) {
    if (el.hasAttribute(name) !== on) el.toggleAttribute(name, on);
  }

  // Sections per column, top to bottom. A group T3 adds later goes to the left column.
  const COLUMNS = [["top", "settled"], ["working", "snoozed"]];
  const scroll = {};
  const itemInfo = new WeakMap(); // li -> { key, off, h } for keeping focused rows visible
  const bars = new Map(); // key -> scrollbar element
  let sections = []; // last layout, in <ul> coordinates
  const hooked = new WeakSet();

  // Gives each section its content height; when a column runs out of room, small sections keep
  // their full height and the rest share what is left equally.
  function allot(list, avail) {
    const out = new Map();
    let left = avail;
    const pending = [...list].sort((a, b) => a.total - b.total);
    pending.forEach((sec, i) => {
      const share = left / (pending.length - i);
      const h = Math.max(Math.min(sec.total, share), Math.min(sec.headH, left));
      out.set(sec, h);
      left -= h;
    });
    return out;
  }

  function bar(key, host) {
    let el = bars.get(key);
    if (!el) {
      el = document.createElement("div");
      el.className = "t3p-sb";
      el.appendChild(document.createElement("i"));
      el.addEventListener("pointerdown", (e) => {
        const sec = sections.find((x) => x.key === key);
        if (!sec || e.button !== 0) return;
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        el.setAttribute("data-dragging", "");
        const thumb = el.firstChild.getBoundingClientRect();
        const track = el.getBoundingClientRect();
        const range = sec.contentH - sec.viewH;
        const ratio = range / Math.max(1, track.height - thumb.height);
        // clicking the track jumps the thumb there; dragging moves it from where it was grabbed
        if (e.clientY < thumb.top || e.clientY > thumb.bottom) {
          scroll[key] = (e.clientY - track.top - thumb.height / 2) * ratio;
          placeThreads();
        }
        const y0 = e.clientY;
        const s0 = scroll[key] || 0;
        const move = (ev) => {
          scroll[key] = s0 + (ev.clientY - y0) * ratio;
          placeThreads();
        };
        const up = () => {
          el.removeEventListener("pointermove", move);
          el.removeEventListener("pointerup", up);
          el.removeEventListener("pointercancel", up);
          el.removeAttribute("data-dragging");
        };
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", up);
        el.addEventListener("pointercancel", up);
      });
      bars.set(key, el);
    }
    if (el.parentElement !== host) host.appendChild(el);
    return el;
  }

  function hook(listPart, viewport) {
    if (!hooked.has(viewport)) {
      hooked.add(viewport);
      // T3 may scroll the list itself (for example to reveal the selected thread); keep it at 0
      viewport.addEventListener("scroll", () => {
        if (html().hasAttribute("data-t3p-open") && viewport.scrollTop) viewport.scrollTop = 0;
      });
      new ResizeObserver(schedule).observe(viewport);
    }
    if (hooked.has(listPart)) return;
    hooked.add(listPart);
    listPart.addEventListener(
      "wheel",
      (e) => {
        if (!html().hasAttribute("data-t3p-open") || !e.deltaY) return;
        const ul = listPart.querySelector('[data-t3p-part="threads"]');
        if (!ul) return;
        const r = ul.getBoundingClientRect();
        const col = e.clientX - r.left > r.width / 2 ? 1 : 0;
        const y = e.clientY - r.top;
        const sec = sections.find((x) => x.col === col && y >= x.top && y < x.top + x.h);
        if (!sec || sec.contentH <= sec.viewH) return;
        e.preventDefault();
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? sec.viewH : 1;
        scroll[sec.key] = (scroll[sec.key] || 0) + e.deltaY * unit;
        placeThreads();
      },
      { passive: false, capture: true },
    );
    listPart.addEventListener("focusin", (e) => {
      const li = e.target.closest?.('[data-t3p-part="threads"] > li');
      const info = li && itemInfo.get(li);
      const sec = info && sections.find((x) => x.key === info.key);
      if (!sec) return;
      const s0 = scroll[info.key] || 0;
      if (info.off < s0) scroll[info.key] = info.off;
      else if (info.off + info.h > s0 + sec.viewH) scroll[info.key] = info.off + info.h - sec.viewH;
      else return;
      placeThreads();
    });
  }

  // T3 renders the thread list as one flat <ul>: threads outside any group, then each group's
  // heading followed by its threads. Places every item in its section and clips it there.
  function placeThreads() {
    const ul = document.querySelector('[data-t3p-part="threads"]');
    const listPart = document.querySelector('[data-t3p-part="list"]');
    const viewport = ul?.closest('[data-slot="scroll-area-viewport"]');
    if (!ul || !listPart || !viewport) return;
    hook(listPart, viewport);
    if (viewport.scrollTop) viewport.scrollTop = 0;

    const byKey = new Map();
    const get = (key) => {
      if (!byKey.has(key)) byKey.set(key, { key, head: null, items: [] });
      return byKey.get(key);
    };
    let cur = get("top");
    for (const li of ul.children) {
      const m = /^sidebar-(\w+)-header$/.exec(li.dataset.testid || "");
      if (m && m[1] !== "pinned") {
        cur = get(m[1]);
        cur.head = li;
      } else cur.items.push(li);
    }
    const columns = COLUMNS.map((keys) => keys.filter((k) => byKey.has(k)).map((k) => byKey.get(k)));
    for (const [k, sec] of byKey) if (!COLUMNS.flat().includes(k)) columns[0].push(sec);

    const vr = viewport.getBoundingClientRect();
    const ur = ul.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(ul.parentElement).paddingBottom) || 0;
    const avail = Math.max(0, Math.floor(vr.bottom - ur.top - pad));
    setVar(ul, "--t3p-list-h", `${avail}px`);
    const lr = listPart.getBoundingClientRect();
    const colW = (ur.width - 8) / 2;

    const next = [];
    columns.forEach((list, col) => {
      const x = col ? "calc(100% + 8px)" : "0px";
      for (const sec of list) {
        sec.headH = sec.head ? sec.head.offsetHeight : 0;
        sec.heights = sec.items.map((li) => li.offsetHeight);
        sec.contentH = sec.heights.reduce((a, b) => a + b, 0);
        sec.total = sec.headH + sec.contentH;
      }
      const sizes = allot(list, avail);
      let top = 0;
      for (const sec of list) {
        const h = sizes.get(sec);
        const viewTop = top + sec.headH;
        const viewH = Math.max(0, h - sec.headH);
        const max = Math.max(0, sec.contentH - viewH);
        const s0 = Math.min(max, Math.max(0, scroll[sec.key] || 0));
        scroll[sec.key] = s0;
        if (sec.head) {
          setVar(sec.head, "--t3p-x", x);
          setVar(sec.head, "--t3p-y", `${top}px`);
          setVar(sec.head, "--t3p-ct", "0px");
          setVar(sec.head, "--t3p-cb", "0px");
          toggle(sec.head, "data-t3p-hidden", false);
        }
        let off = 0;
        sec.items.forEach((li, i) => {
          const ih = sec.heights[i];
          const y = viewTop + off - s0;
          const ct = Math.max(0, viewTop - y);
          const cb = Math.max(0, y + ih - (viewTop + viewH));
          setVar(li, "--t3p-x", x);
          setVar(li, "--t3p-y", `${Math.round(y)}px`);
          setVar(li, "--t3p-ct", `${Math.round(ct)}px`);
          setVar(li, "--t3p-cb", `${Math.round(cb)}px`);
          toggle(li, "data-t3p-hidden", ih > 0 && (ct >= ih || cb >= ih));
          itemInfo.set(li, { key: sec.key, off, h: ih });
          off += ih;
        });
        next.push({ key: sec.key, col, top, h, viewTop, viewH, contentH: sec.contentH });

        const el = bar(sec.key, listPart);
        const over = sec.contentH > viewH + 1 && viewH > 24;
        toggle(el, "data-on", over);
        if (over) {
          const left = ur.left - lr.left + (col ? colW + 8 : 0) + colW - 10;
          const tTop = ur.top - lr.top + viewTop + 2;
          const trackH = viewH - 4;
          const thumbH = Math.max(24, (trackH * viewH) / sec.contentH);
          setVar(el, "left", `${Math.round(left)}px`);
          setVar(el, "top", `${Math.round(tTop)}px`);
          setVar(el, "height", `${Math.round(trackH)}px`);
          setVar(el.firstChild, "height", `${Math.round(thumbH)}px`);
          setVar(el.firstChild, "top", `${Math.round(((trackH - thumbH) * s0) / max)}px`);
        }
        top += h;
      }
    });
    sections = next;
    for (const [key, el] of bars) if (!next.some((x) => x.key === key)) toggle(el, "data-on", false);
  }

  function sync() {
    if (!document.body) return;
    ensureStyle();
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth >= MIN_WIDTH;
    if (!wrapper || !portrait) {
      setAttr("data-t3p", null);
      setAttr("data-t3p-open", null);
      syncBottomPanel();
      syncTelemetry();
      return;
    }

    const sidebar = wrapper.querySelector(':scope > [data-slot="sidebar"]');
    const container = sidebar?.querySelector('[data-slot="sidebar-container"]');
    const inset = wrapper.querySelector(':scope > [data-slot="sidebar-inset"]');
    broken = !sidebar || !container || !inset;

    const host = document.querySelector("[data-panel-layout-controls]");
    if (host) ensureButton(host);
    ensureDivider();

    const mode = broken ? "broken" : state.on ? "top" : "off";
    setAttr("data-t3p", mode);
    updateButton();

    const open = mode === "top" && markParts(container.querySelector('[data-slot="sidebar-inner"]') || container);
    setAttr("data-t3p-open", open ? "" : null);
    if (open) placeThreads();
    syncBottomPanel();
    syncTelemetry();
  }

  let queued = false;
  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      sync();
    });
  }

  let mo;
  let telTimer;
  const mq = matchMedia("(orientation: portrait)");

  function start() {
    applyH();
    sync();
    mo = new MutationObserver(schedule);
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-workspace-unavailable", "data-preview-panel-maximized", "data-state", "data-open"],
    });
    window.addEventListener("resize", schedule);
    mq.addEventListener("change", schedule);
    telTimer = setInterval(() => {
      if (!document.hidden) syncTelemetry();
    }, 2000);
    document.__t3pCleanup = () => {
      mo?.disconnect();
      clearInterval(telTimer);
      window.removeEventListener("resize", schedule);
      mq.removeEventListener("change", schedule);
      [style, divider, bpDivider, btnWrap, telBar, telPop, telHostFallback].forEach((el) => el?.remove());
      for (const el of bars.values()) el.remove();
      document.body?.removeAttribute("data-t3p-resizing");
      document.__t3portrait = false;
      document.__t3pCleanup = null;
    };
  }

  const first = document;
  const boot = () => {
    if (document !== first) {
      // the window got a new document; take it over unless another copy already did
      if (document.__t3portrait) return;
      document.__t3portrait = true;
    }
    if (document.body) start();
    else setTimeout(boot, 50);
  };
  boot();
})();
