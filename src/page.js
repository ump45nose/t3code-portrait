// Runs inside T3 Code's window. In a portrait window it moves the sidebar to the top, shows threads
// in two columns of two-line cards (left: top threads and Settled; right: Working and Snoozed), gathers the sidebar's buttons into one row above the chat title,
// and adds a toggle button to the chat header. Only T3's own DOM markers are used; when they are missing, nothing is changed.
(() => {
  // The script can run before the page's real document exists, so the guard is per document.
  if (document.__t3portrait) return;
  document.__t3portrait = true;

  const KEY = "t3portrait:v1";
  const MIN_H = 15;
  const MAX_H = 70;
  const DEFAULT_H = 35;
  // T3 switches to its own mobile layout below Tailwind's md breakpoint.
  const MIN_WIDTH = 768;

  const state = { on: true, h: DEFAULT_H };
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
  const applyH = () => html().style.setProperty("--t3p-h", String(clampH(state.h)));

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

/* two columns that stack on their own: left holds the top threads and Settled, right holds
   Working and Snoozed. 1px rows let each item span its own height, so neither column leaves gaps.
   Each item's column and height come from script (--t3p-col, --t3p-span). */
html[data-t3p-open] [data-t3p-part="threads"] {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 8px;
  grid-auto-rows: 1px; row-gap: 0; grid-auto-flow: row dense; align-items: start;
}
html[data-t3p-open] [data-t3p-part="threads"] > li {
  grid-column: var(--t3p-col, 1); grid-row-end: span var(--t3p-span, 1);
  margin-top: 0; content-visibility: visible;
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
  let btnWrap;
  let btn;
  let broken = false;

  function ensureStyle() {
    if (style?.isConnected) return;
    style = document.createElement("style");
    style.id = "t3p-style";
    style.textContent = CSS;
    (document.head || html()).appendChild(style);
  }

  function ensureDivider() {
    if (divider?.isConnected) return;
    divider = document.createElement("div");
    divider.id = "t3p-divider";
    divider.setAttribute("role", "separator");
    divider.setAttribute("aria-orientation", "horizontal");
    divider.title = "拖动调整边栏高度，双击恢复默认";
    divider.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      divider.setPointerCapture(e.pointerId);
      divider.setAttribute("data-dragging", "");
      document.body.setAttribute("data-t3p-resizing", "");
      const move = (ev) => {
        state.h = clampH((ev.clientY / window.innerHeight) * 100);
        applyH();
      };
      const up = () => {
        divider.removeEventListener("pointermove", move);
        divider.removeEventListener("pointerup", up);
        divider.removeEventListener("pointercancel", up);
        divider.removeAttribute("data-dragging");
        document.body.removeAttribute("data-t3p-resizing");
        save();
      };
      divider.addEventListener("pointermove", move);
      divider.addEventListener("pointerup", up);
      divider.addEventListener("pointercancel", up);
    });
    divider.addEventListener("dblclick", () => {
      state.h = DEFAULT_H;
      applyH();
      save();
    });
    document.body.appendChild(divider);
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

  const RIGHT = new Set(["working", "snoozed"]);
  function setVar(el, name, value) {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
  }
  // T3 renders the thread list as one flat <ul>: top threads, then each group's heading followed
  // by its threads. Each item goes to the column of the group it follows.
  function placeThreads() {
    const ul = document.querySelector('[data-t3p-part="threads"]');
    if (!ul) return;
    let group = "top";
    for (const li of ul.children) {
      const m = /^sidebar-(\w+)-header$/.exec(li.dataset.testid || "");
      if (m && m[1] !== "pinned") group = m[1];
      setVar(li, "--t3p-col", RIGHT.has(group) ? "2" : "1");
      setVar(li, "--t3p-span", String(Math.max(1, Math.ceil(li.getBoundingClientRect().height))));
    }
  }

  function sync() {
    if (!document.body) return;
    ensureStyle();
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth >= MIN_WIDTH;
    if (!wrapper || !portrait) {
      setAttr("data-t3p", null);
      setAttr("data-t3p-open", null);
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

  function start() {
    applyH();
    sync();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", schedule);
    matchMedia("(orientation: portrait)").addEventListener("change", schedule);
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
