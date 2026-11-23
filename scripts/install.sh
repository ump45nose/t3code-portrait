#!/bin/bash
# Builds the "T3 Code 竖屏" launcher app into ~/Applications (or --dest DIR).
#   scripts/install.sh [--t3-app PATH] [--port N] [--dest DIR]
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
PORT=9338
DEST="$HOME/Applications"
T3_APP=""

while [ $# -gt 0 ]; do
  case "$1" in
    --t3-app) T3_APP="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --dest) DEST="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

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

BUNDLE_ID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$T3_APP/Contents/Info.plist")"
APP="$DEST/T3 Code 竖屏.app"

mkdir -p "$DEST"
[ -d "$APP" ] && rm -r "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

sed -e "s#__T3_APP__#$T3_APP#" \
    -e "s#__T3_BUNDLE_ID__#$BUNDLE_ID#" \
    -e "s#__NODE__#$NODE#" \
    -e "s#__INJECTOR__#$REPO/src/injector.mjs#" \
    -e "s#__PORT__#$PORT#" \
    "$REPO/scripts/launch.sh" > "$APP/Contents/MacOS/launch"
chmod +x "$APP/Contents/MacOS/launch"

ICON="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' "$T3_APP/Contents/Info.plist" 2>/dev/null || echo icon)"
ICON="${ICON%.icns}.icns"
[ -f "$T3_APP/Contents/Resources/$ICON" ] && cp "$T3_APP/Contents/Resources/$ICON" "$APP/Contents/Resources/icon.icns"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>T3 Code 竖屏</string>
  <key>CFBundleDisplayName</key><string>T3 Code 竖屏</string>
  <key>CFBundleIdentifier</key><string>io.github.ump45nose.t3code-portrait</string>
  <key>CFBundleExecutable</key><string>launch</string>
  <key>CFBundleIconFile</key><string>icon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSUIElement</key><true/>
</dict>
</plist>
PLIST

echo "Installed: $APP"
echo "T3 Code: $T3_APP (port $PORT)"
