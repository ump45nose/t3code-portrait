#!/bin/bash
# Installs (or removes) a LaunchAgent that watches for T3 Code launches and automatically
# enables portrait mode even when T3 Code is opened from the regular Dock / Spotlight icon.
#
#   scripts/install-autostart.sh [--t3-app PATH] [--port N]
#   scripts/install-autostart.sh --uninstall
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LABEL="io.github.ump45nose.t3code-portrait.watcher"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SUPPORT_DIR="$HOME/Library/Application Support/t3code-portrait"
BIN="$SUPPORT_DIR/watcher"
LOG_DIR="$HOME/Library/Logs/t3code-portrait"
PORT=9338
T3_APP=""
UNINSTALL=0

while [ $# -gt 0 ]; do
  case "$1" in
    --t3-app) T3_APP="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --uninstall) UNINSTALL=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

UID_NUM="$(id -u)"

if [ "$UNINSTALL" -eq 1 ]; then
  launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
  rm -f "$PLIST" "$BIN"
  echo "Uninstalled autostart LaunchAgent: $LABEL"
  exit 0
fi

if [ -z "$T3_APP" ]; then
  for candidate in "/Applications/T3 Code.app" "/Applications/T3 Code (Nightly).app" "$HOME/Applications/T3 Code.app" "$HOME/Applications/T3 Code (Nightly).app"; do
    [ -d "$candidate" ] && T3_APP="$candidate" && break
  done
fi
[ -d "$T3_APP" ] || { echo "T3 Code not found; pass --t3-app PATH" >&2; exit 1; }

NODE="$(command -v node || true)"
[ -n "$NODE" ] || { echo "node not found on PATH (Node 22.4 or newer is required)" >&2; exit 1; }
"$NODE" -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=4)?0:1)' \
  || { echo "Node 22.4 or newer is required ($("$NODE" -v) found)" >&2; exit 1; }

command -v swiftc >/dev/null 2>&1 || { echo "swiftc not found (install Xcode Command Line Tools)" >&2; exit 1; }

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$T3_APP/Contents/Info.plist")"

mkdir -p "$SUPPORT_DIR" "$LOG_DIR" "$HOME/Library/LaunchAgents"
swiftc -O -framework AppKit "$REPO/scripts/watch.swift" -o "$BIN"

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$BIN</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>T3P_APP</key><string>$T3_APP</string>
    <key>T3P_BUNDLE_ID</key><string>$BUNDLE_ID</string>
    <key>T3P_NODE</key><string>$NODE</string>
    <key>T3P_INJECTOR</key><string>$REPO/src/injector.mjs</string>
    <key>T3P_PORT</key><string>$PORT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOG_DIR/watcher.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/watcher.log</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$UID_NUM/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST"
echo "Installed & started: $LABEL"
echo "Watching: $T3_APP ($BUNDLE_ID) on port $PORT"
echo "Log: $LOG_DIR/watcher.log"
