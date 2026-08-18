#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# F2H Fresh — Flutter Web Dev Launcher (tmux + inotifywait hot-reload)
# Fixed socket: /tmp/f2h-tmux.sock  — consistent across all shells
# Usage: ./dev-flutter.sh [both|customer|partner|stop|status|reload|logs]
# ═══════════════════════════════════════════════════════════════════════════════
FLUTTER=/usr/local/bin/flutter
REPO=/home/f2hfresh/htdocs/f2hfresh.com
CUSTOMER_DIR=$REPO/apps/mobile/customer
PARTNER_DIR=$REPO/apps/mobile/delivery
LOG_DIR=/home/f2hfresh/logs/flutter
SOCK=/tmp/f2h-tmux.sock
DART_API=https://f2hfresh.com
G="\033[0;32m"; Y="\033[1;33m"; R="\033[0;31m"; C="\033[0;36m"; NC="\033[0m"
TMUX="tmux -S $SOCK"
mkdir -p "$LOG_DIR"

start_app() {
  local NAME="$1"
  local DIR="$2"
  local PORT="$3"
  local SESSION="flutter_${NAME}"

  # Kill existing session for this app
  $TMUX kill-session -t "$SESSION" 2>/dev/null || true
  pkill -f "inotifywait.*${NAME}" 2>/dev/null || true
  sleep 0.5

  echo -e "${C}▶  Starting Flutter ${NAME} on :${PORT}…${NC}"

  # Launch flutter run inside a detached tmux session using fixed socket
  $TMUX new-session -d -s "$SESSION" -x 220 -y 50 \
    "cd '${DIR}' && \
     ${FLUTTER} pub get -q 2>&1 ; \
     ${FLUTTER} run --debug -d web-server \
       --web-port=${PORT} --web-hostname=0.0.0.0 \
       --dart-define=F2H_API_BASE_URL=${DART_API} 2>&1 | \
     tee '${LOG_DIR}/${NAME}.log'"

  echo -e "${G}  ✓ tmux session: ${SESSION}   Port: ${PORT}${NC}"
  echo -e "${G}    attach:  tmux -S ${SOCK} attach -t ${SESSION}${NC}"
  echo -e "${G}    logs:    tail -f ${LOG_DIR}/${NAME}.log${NC}"

  # Launch inotifywait watcher in background — sends 'r' via tmux on .dart change
  WATCHER_SCRIPT="${LOG_DIR}/${NAME}_watcher.sh"
  cat > "$WATCHER_SCRIPT" << WATCHEOF
#!/bin/bash
SOCK="${SOCK}"
SESSION="${SESSION}"
DIR="${DIR}"
LOG="${LOG_DIR}/${NAME}_watcher.log"
echo "Watcher started for ${NAME} at \$(date)" >> "\$LOG"
while true; do
  inotifywait -r -q -e modify,create --include '.*\.dart$' "\${DIR}/lib" 2>/dev/null
  sleep 0.3
  tmux -S "\${SOCK}" send-keys -t "\${SESSION}" 'r' '' 2>/dev/null && \
    echo "\$(date +'%H:%M:%S') hot-reload ▶ ${NAME}" >> "\$LOG" || \
    echo "\$(date +'%H:%M:%S') WARN: send-keys failed" >> "\$LOG"
done
WATCHEOF
  chmod +x "$WATCHER_SCRIPT"
  nohup bash "$WATCHER_SCRIPT" >/dev/null 2>&1 &
  echo $! > "${LOG_DIR}/${NAME}_watch.pid"
  echo -e "${G}  ✓ watcher started — save any .dart file → instant hot-reload${NC}"
}

stop_app() {
  local NAME="$1"
  $TMUX kill-session -t "flutter_${NAME}" 2>/dev/null || true
  if [ -f "${LOG_DIR}/${NAME}_watch.pid" ]; then
    kill -9 "$(cat "${LOG_DIR}/${NAME}_watch.pid")" 2>/dev/null || true
    rm -f "${LOG_DIR}/${NAME}_watch.pid"
  fi
}

stop_all() {
  echo -e "${Y}■  Stopping all Flutter servers…${NC}"
  stop_app customer
  stop_app partner
  pkill -f "flutter.*web-server" 2>/dev/null || true
  pkill -f "inotifywait" 2>/dev/null || true
  $TMUX kill-server 2>/dev/null || true
  echo -e "${G}  ✓ Done${NC}"
}

status_all() {
  echo -e "${C}Flutter dev servers:${NC}"
  for name in customer partner; do
    PORT=$([[ "$name" == "customer" ]] && echo 8081 || echo 8082)
    RESP=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://localhost:${PORT}/ 2>/dev/null)
    if [[ "$RESP" == "200" ]]; then
      echo -e "  ${G}● ${name}   :${PORT}  RUNNING (HTTP 200)${NC}"
    elif $TMUX has-session -t "flutter_${name}" 2>/dev/null; then
      echo -e "  ${Y}● ${name}   :${PORT}  STARTING (tmux session alive, port not ready yet)${NC}"
    else
      echo -e "  ${R}○ ${name}   :${PORT}  STOPPED${NC}"
    fi
  done
  echo ""
  $TMUX list-sessions 2>/dev/null || echo "  (no tmux sessions on $SOCK)"
}

case "${1:-both}" in
  customer)  start_app customer "$CUSTOMER_DIR" 8081 ;;
  partner)   start_app partner  "$PARTNER_DIR"  8082 ;;
  stop)      stop_all ;;
  status)    status_all ;;
  reload)
    TARGET="${2:-customer}"
    $TMUX send-keys -t "flutter_${TARGET}" 'r' '' && \
      echo -e "${G}  ✓ Hot-reload → ${TARGET}${NC}" || \
      echo -e "${R}  ✗ ${TARGET} session not found${NC}" ;;
  logs)
    tail -f "${LOG_DIR}/${2:-customer}.log" ;;
  both|*)
    # Kill everything and restart fresh
    pkill -f "flutter.*web-server" 2>/dev/null || true
    pkill -f "inotifywait" 2>/dev/null || true
    $TMUX kill-server 2>/dev/null || true
    sleep 1

    start_app customer "$CUSTOMER_DIR" 8081
    start_app partner  "$PARTNER_DIR"  8082

    echo ""
    echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${G}  ⚡ FLUTTER HOT-RELOAD ACTIVE (tmux -S ${SOCK})${NC}"
    echo -e ""
    echo -e "${G}  HOW TO DEVELOP FAST:${NC}"
    echo -e "  1. Open https://customer.f2hfresh.com once (1300 DDC modules load)"
    echo -e "  2. After 1st load, modules CACHE → future soft-refreshes < 3s"
    echo -e "  3. Save any .dart file → auto hot-reload → browser updates < 1s"
    echo -e "  4. ❌ NEVER use Ctrl+Shift+R (hard refresh bypasses cache = 60s!)"
    echo -e "  5. ✅ Use Ctrl+R (soft refresh) only if hot-reload didn't apply"
    echo -e ""
    echo -e "${C}  COMMANDS:${NC}"
    echo -e "  ./dev-flutter.sh status              # check running status"
    echo -e "  ./dev-flutter.sh reload customer     # manual hot-reload"
    echo -e "  ./dev-flutter.sh logs customer       # follow flutter output"
    echo -e "  tmux -S ${SOCK} attach -t flutter_customer"
    echo -e "${C}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    ;;
esac
