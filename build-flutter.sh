#!/usr/bin/env bash
set -e
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CUSTOMER_DIR="$REPO/apps/mobile/customer"
PARTNER_DIR="$REPO/apps/mobile/delivery"
DART_API="${F2H_API_URL:-https://dev.f2hfresh.com}"
FLUTTER="$(which flutter 2>/dev/null || echo /snap/bin/flutter)"

G="\033[0;32m"; C="\033[0;36m"; Y="\033[1;33m"; NC="\033[0m"

build_app() {
  local NAME="$1"
  local DIR="$2"
  local SHOULD_CLEAN="$3"
  local HTDOCS_TARGET=""

  if [ "$NAME" = "customer" ]; then
    HTDOCS_TARGET="/home/f2hfresh-c/htdocs/c.f2hfresh.com"
  elif [ "$NAME" = "partner" ]; then
    HTDOCS_TARGET="/home/f2hfresh-p/htdocs/p.f2hfresh.com"
  fi

  echo -e "${C}▶  Building Flutter ${NAME}…${NC}"
  cd "$DIR"

  if [ "$SHOULD_CLEAN" = "true" ]; then
    echo -e "${Y}  🧹 Cleaning Flutter caches in ${NAME}…${NC}"
    "$FLUTTER" clean
    "$FLUTTER" pub get
  fi

  "$FLUTTER" build web --release --no-wasm-dry-run --no-tree-shake-icons --dart-define=F2H_API_BASE_URL="${DART_API}"
  
  # Touch build ID
  date +%s > "$DIR/build/web/.last_build_id"

  # Sync to satellite htdocs if directory exists
  if [ -n "$HTDOCS_TARGET" ] && [ -d "$HTDOCS_TARGET" ]; then
    echo -e "${C}  🔄 Syncing to ${HTDOCS_TARGET}…${NC}"
    cp -r "$DIR/build/web/"* "$HTDOCS_TARGET/"
    chmod -R 755 "$HTDOCS_TARGET/" || true
  fi

  chmod -R 755 "$DIR/build/web/" || true
  echo -e "${G}  ✓ ${NAME} built and deployed successfully!${NC}"
}

DO_CLEAN="false"
TARGET="both"

for arg in "$@"; do
  case "$arg" in
    clean|--clean) DO_CLEAN="true" ;;
    customer) TARGET="customer" ;;
    partner) TARGET="partner" ;;
    both) TARGET="both" ;;
  esac
done

case "$TARGET" in
  customer) build_app customer "$CUSTOMER_DIR" "$DO_CLEAN" ;;
  partner)  build_app partner  "$PARTNER_DIR"  "$DO_CLEAN" ;;
  both|*)
    build_app customer "$CUSTOMER_DIR" "$DO_CLEAN"
    build_app partner  "$PARTNER_DIR"  "$DO_CLEAN"
    ;;
esac
