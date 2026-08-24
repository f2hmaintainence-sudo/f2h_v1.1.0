#!/usr/bin/env bash
set -e
REPO=/home/f2hfresh/htdocs/f2hfresh.com
CUSTOMER_DIR=$REPO/apps/mobile/customer
PARTNER_DIR=$REPO/apps/mobile/delivery
DART_API=https://f2hfresh.com

G="\033[0;32m"; C="\033[0;36m"; Y="\033[1;33m"; NC="\033[0m"

build_app() {
  local NAME="$1"
  local DIR="$2"
  local SHOULD_CLEAN="$3"
  local HTDOCS_TARGET="/home/f2hfresh-${NAME}/htdocs/${NAME}.f2hfresh.com"

  echo -e "${C}▶  Building Flutter ${NAME}…${NC}"
  cd "$DIR"

  if [ "$SHOULD_CLEAN" = "true" ]; then
    echo -e "${Y}  🧹 Cleaning Flutter caches in ${NAME}…${NC}"
    flutter clean
    flutter pub get
  fi

  flutter build web --release --no-wasm-dry-run --no-tree-shake-icons --dart-define=F2H_API_BASE_URL="${DART_API}"
  
  # Touch build ID
  date +%s > "$DIR/build/web/.last_build_id"

  # Sync to satellite htdocs if directory exists
  if [ -d "$HTDOCS_TARGET" ]; then
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

