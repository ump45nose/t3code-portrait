#!/bin/bash
# Opens T3 Code with a local debugging port and starts the injector.
# Installed into the launcher app by scripts/install.sh, which fills in the settings below.
set -u

T3_APP="__T3_APP__"
T3_BUNDLE_ID="__T3_BUNDLE_ID__"
NODE="__NODE__"
INJECTOR="__INJECTOR__"
PORT="__PORT__"
LOG_DIR="$HOME/Library/Logs/t3code-portrait"
LOG="$LOG_DIR/injector.log"

mkdir -p "$LOG_DIR"

port_open() { curl -s -m 1 "http://127.0.0.1:$PORT/json/version" | grep -q webSocketDebuggerUrl; }
t3_running() { [ "$(osascript -e "application id \"$T3_BUNDLE_ID\" is running" 2>/dev/null)" = "true" ]; }
start_injector() {
  pgrep -fq -- "injector.mjs --port $PORT" && return
  nohup "$NODE" "$INJECTOR" --port "$PORT" >>"$LOG" 2>&1 &
}

if port_open; then
  start_injector
  open -a "$T3_APP"
  exit 0
fi

if t3_running; then
  answer=$(osascript -e 'button returned of (display dialog "T3 Code 正在运行，但没有开启竖屏布局。要退出 T3 Code 并重新打开吗？" buttons {"取消", "退出并重新打开"} default button 2 with title "T3 Code 竖屏")' 2>/dev/null) || exit 0
  [ "$answer" = "退出并重新打开" ] || exit 0
  osascript -e "tell application id \"$T3_BUNDLE_ID\" to quit"
  for _ in $(seq 1 40); do t3_running || break; sleep 0.5; done
  if t3_running; then
    osascript -e 'display dialog "T3 Code 没有在 20 秒内退出，请手动退出后再打开。" buttons {"好"} with title "T3 Code 竖屏"' >/dev/null 2>&1
    exit 1
  fi
fi

open -a "$T3_APP" --args --remote-debugging-port="$PORT"
start_injector
