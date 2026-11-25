# t3code-portrait

Portrait layout for [T3 Code](https://github.com/pingdotgg/t3code) Desktop on macOS, added from
outside the app. T3 Code's installation is not modified.

When the T3 Code window is taller than it is wide:

- the sidebar moves to the top of the window, split into two columns: threads outside any group,
  then Settled on the left; Working, then Snoozed on the right. Each of the four sections scrolls
  on its own with its own scrollbar when it doesn't fit (mouse wheel over a section, drag its
  thumb, or move focus with the keyboard); every group keeps its expand state;
- cards take two lines: project, device and agent on the first, title and status on the second;
- the sidebar toggle collapses and expands the top area with a short animation;
- the sidebar's buttons are gathered in one row right above the chat title: the sidebar toggle
  (pointing up), settings and the other footer buttons, search, filter, add project, new thread,
  then back and forward on the right;
- a drag handle under that row sets the sidebar height (15–70% of the window, double-click resets
  to 35%);
- the right-side preview/diff/file-tree panel moves to the bottom of the chat area with its own drag
  handle (20–75%, double-click resets to 42%);
- a button in the chat header, left of T3's own panel buttons, turns the layout on and off.

In both portrait and landscape windows, a compact status strip under the composer shows the session's
cache hit rate (preferring the latest turn), a context window percentage ring, quota rings
(single ring for weekly-only providers, concentric dual ring for 5h + weekly, and two dual rings for
Antigravity where an exhausted weekly window clears its paired 5h reading), and the session's
cumulative token usage and reported cost.

In a landscape window the layout itself is unchanged. T3's own sidebar toggle still hides the sidebar. If T3 Code
changes its interface and the sidebar can't be found, the layout is left alone and the button is
greyed out with the reason in its tooltip. The on/off state and the height are kept in T3's page
storage.

## Requirements

- macOS, T3 Code Desktop (`/Applications/T3 Code.app` or `T3 Code (Nightly).app`)
- Node.js 22.4 or newer on `PATH`

## Install

### Option A: Auto-enable when opening the regular T3 Code app (recommended)

```sh
git clone https://github.com/ump45nose/t3code-portrait.git
cd t3code-portrait
scripts/install-autostart.sh  # options: --t3-app PATH  --port N (default 9338)  --uninstall
```

This installs a lightweight macOS `LaunchAgent` that listens to `NSWorkspace` app-launch events
(zero polling). Keep the regular **T3 Code** icon in your Dock; whenever you open it without the
debugging port, the watcher cleanly relaunches it with `--remote-debugging-port` and attaches the
injector.

### Option B: Separate launcher app

```sh
scripts/install.sh            # options: --t3-app PATH  --port N (default 9338)  --dest DIR
```

This creates `~/Applications/T3 Code 竖屏.app`. Opening T3 Code directly runs it without the layout.

A debugging port lets any program on this Mac control T3 Code. It listens on `127.0.0.1` only.

Logs: `~/Library/Logs/t3code-portrait/watcher.log` and `injector.log`.

## Uninstall

- Auto-enable mode: run `scripts/install-autostart.sh --uninstall`.
- Launcher app: quit T3 Code, then delete `~/Applications/T3 Code 竖屏.app`.

## Claude-style theme

`theme/claude.json` is a T3 Code theme in Claude's style, light and dark: warm neutrals, clay for
the accent and the Working status, a dark round stop button, a quiet composer border, PingFang for
the interface and for Chinese text, serif Latin text in assistant replies, and rounder corners. It needs no launcher: in T3 Code open
Settings → Appearance → Add theme, choose the file, then pick **Claude Warm**.

## How it works

- `src/injector.mjs` attaches to T3 Code's debugging port and registers `src/page.js` to run in
  every T3 window document, including after reloads.
- `src/page.js` adds a stylesheet and the button and drag handle. It only uses T3's DOM markers
  (`data-slot="sidebar…"`, `data-sidebar-control`, `data-panel-layout-controls`,
  `data-testid="sidebar-row-card"`) and changes nothing when they are missing.
- `scripts/launch.sh` is the launcher app's executable; `scripts/install.sh` fills in the paths.

Changes to `src/` apply the next time T3 Code is opened through the launcher. After changing the
theme file, remove **Claude Warm** in Settings → Appearance and add the file again.

## License

MIT
