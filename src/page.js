// Runs inside T3 Code's window. In a portrait window it moves the sidebar to the top (two columns),
// puts the sidebar's search row and footer buttons under the composer, and adds a toggle button to
// the chat header. Only T3's own DOM markers are used; when they are missing, nothing is changed.
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
html[data-t3p="top"] [data-slot="sidebar-wrapper"] > [data-slot="sidebar"] {
  display: block; width: 100%; height: calc(var(--t3p-h) * 1dvh); flex: none;
}
html[data-t3p="top"] [data-slot="sidebar-wrapper"] > [data-slot="sidebar"][data-state="collapsed"] { display: none; }
html[data-t3p="top"] [data-slot="sidebar-gap"],
html[data-t3p="top"] [data-slot="sidebar-rail"] { display: none; }
html[data-t3p="top"] [data-slot="sidebar-container"] {
  position: relative; inset: auto; left: auto; right: auto; z-index: auto;
  display: flex; width: 100%; height: 100%;
  border-bottom: 1px solid var(--sidebar-border);
}
html[data-t3p="top"] [data-slot="sidebar-wrapper"] > [data-slot="sidebar-inset"] { flex: 1 1 0; min-height: 0; }
html[data-t3p="top"] [data-workspace-titlebar-controls] { position: absolute; }

/* two columns: threads on the left, status groups (working / snoozed / settled) on the right */
html[data-t3p="top"] [data-slot="sidebar-content"] > [data-slot="sidebar-group"] > ul {
  display: block; columns: 2; column-gap: 12px;
}
html[data-t3p="top"] [data-slot="sidebar-content"] > [data-slot="sidebar-group"] > ul > li { break-inside: avoid; }
html[data-t3p="top"] [data-slot="sidebar-content"] > [data-slot="sidebar-group"] > ul > li:nth-child(1 of [data-testid^="sidebar-"][data-testid$="-header"]:not([data-testid="sidebar-pinned-header"])) {
  break-before: column; margin-top: 0;
}

/* search row and footer buttons under the composer */
html[data-t3p-bar] [data-chat-composer-overlay] { padding-bottom: 40px; }
html[data-t3p-bar] [data-t3p-foot],
html[data-t3p-bar] [data-t3p-search] {
  position: fixed; bottom: 8px; z-index: 30; padding: 0;
}
html[data-t3p-bar] [data-t3p-foot] { left: var(--t3p-bl); width: auto; }
html[data-t3p-bar] [data-t3p-search] { right: var(--t3p-br); width: min(340px, 45vw); }
html[data-t3p-bar] [data-t3p-search] [data-slot="sidebar-group"] { padding: 0; }

#t3p-divider {
  display: none; position: fixed; left: 0; right: 0; z-index: 40;
  top: calc(var(--t3p-h) * 1dvh - 5px); height: 10px; cursor: row-resize; touch-action: none;
}
#t3p-divider::after {
  content: ""; position: absolute; left: 0; right: 0; top: 4px; height: 2px;
}
#t3p-divider:hover::after, #t3p-divider[data-dragging]::after { background: var(--sidebar-border); }
html[data-t3p="top"] #t3p-divider { display: block; }
html[data-t3p="top"]:has([data-slot="sidebar"][data-state="collapsed"]) #t3p-divider { display: none; }
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

  function mark(el, name) {
    if (el && !el.hasAttribute(name)) el.setAttribute(name, "");
  }

  let barLeft = "";
  let barRight = "";
  function placeBar(composer) {
    const r = composer.getBoundingClientRect();
    const l = `${Math.max(12, Math.round(r.left))}px`;
    const rr = `${Math.max(12, Math.round(window.innerWidth - r.right))}px`;
    if (l !== barLeft) html().style.setProperty("--t3p-bl", (barLeft = l));
    if (rr !== barRight) html().style.setProperty("--t3p-br", (barRight = rr));
  }

  function sync() {
    if (!document.body) return;
    ensureStyle();
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]');
    const portrait = window.innerHeight > window.innerWidth && window.innerWidth >= MIN_WIDTH;
    if (!wrapper || !portrait) {
      setAttr("data-t3p", null);
      setAttr("data-t3p-bar", null);
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

    let bar = false;
    if (mode === "top" && sidebar.dataset.state !== "collapsed") {
      const inner = container.querySelector('[data-slot="sidebar-inner"]');
      const foot = inner?.querySelector(':scope > [data-slot="sidebar-footer"], :scope > * > [data-slot="sidebar-footer"]');
      const search = inner
        ?.querySelector('[data-slot="sidebar-group"] [data-slot="input"]')
        ?.closest('[data-slot="sidebar-group"]')?.parentElement;
      const composer = document.querySelector("[data-chat-composer-stack]");
      if (composer && (foot || search)) {
        // the search row lives outside the scrolling list; never move anything inside the list
        if (search && !search.closest('[data-slot="sidebar-content"]')) mark(search, "data-t3p-search");
        mark(foot, "data-t3p-foot");
        placeBar(composer);
        bar = true;
      }
    }
    setAttr("data-t3p-bar", bar ? "" : null);
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
