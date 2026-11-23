// Runs inside T3 Code's window. In a portrait window it moves the sidebar to the top and shows threads
// as two-line cards in two columns of independently scrolling sections (left: threads outside any
// group, then Settled; right: Working, then Snoozed). It gathers the sidebar's buttons into one row
// above the chat title and adds a toggle button to the chat header. Only T3's own DOM markers are used; when they are missing, nothing is changed.
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
