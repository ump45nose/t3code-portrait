# t3code-portrait

Portrait layout for [T3 Code](https://github.com/pingdotgg/t3code) Desktop on macOS, added from
outside the app. T3 Code's installation is not modified.

When the T3 Code window is taller than it is wide:

- the sidebar moves to the top of the window; threads are shown in two columns (left: threads outside any group, then
  Settled; right: Working, then Snoozed), each card on two
  lines (project, device and agent on the first, the title and status on the second), and the
  Working / Snoozed / Settled groups keep their own expand state;
- the sidebar toggle collapses and expands the top area with a short animation;
- the sidebar's buttons are gathered in one row right above the chat title: the sidebar toggle
  (pointing up), settings and the other footer buttons, search, filter, add project, new thread,
  then back and forward on the right;
- a drag handle under that row sets the sidebar height (15–70% of the window, double-click resets
  to 35%);
- a button in the chat header, left of T3's own panel buttons, turns the layout on and off.

In a landscape window nothing changes. T3's own sidebar toggle still hides the sidebar. If T3 Code
changes its interface and the sidebar can't be found, the layout is left alone and the button is
greyed out with the reason in its tooltip. The on/off state and the height are kept in T3's page
storage.

## Requirements

- macOS, T3 Code Desktop (`/Applications/T3 Code.app` or `T3 Code (Nightly).app`)
- Node.js 22.4 or newer on `PATH`

## Install

```sh
git clone https://github.com/ump45nose/t3code-portrait.git
cd t3code-portrait
scripts/install.sh            # options: --t3-app PATH  --port N (default 9338)  --dest DIR
```

This creates `~/Applications/T3 Code 竖屏.app`. Open T3 Code through it (drag it to the Dock in
place of T3 Code). It starts T3 Code with a debugging port on `127.0.0.1` and runs the injector,
which exits when T3 Code quits. If T3 Code is already running without the port, the launcher asks
before quitting and reopening it. Opening T3 Code directly runs it without the layout.

A debugging port lets any program on this Mac control T3 Code. It listens on `127.0.0.1` only.

Log: `~/Library/Logs/t3code-portrait/injector.log`

## Uninstall

Quit T3 Code, then delete `~/Applications/T3 Code 竖屏.app`.

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
