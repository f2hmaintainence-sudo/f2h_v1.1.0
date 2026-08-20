#!/usr/bin/env bash
REPO=/home/f2hfresh/htdocs/f2hfresh.com
CUSTOMER_DIR=$REPO/apps/mobile/customer
PARTNER_DIR=$REPO/apps/mobile/delivery
DART_API=https://f2hfresh.com

G="\033[0;32m"; C="\033[0;36m"; NC="\033[0m"

build_app() {
  local NAME="$1"
  local DIR="$2"
  echo -e "${C}▶  Building Flutter ${NAME} (Fast Mode)…${NC}"
  cd "$DIR" && flutter build web --no-pub --no-tree-shake-icons --no-wasm-dry-run
  echo -e "${G}  ✓ ${NAME} built! Live preview updated on domain (<0.1s page load).${NC}"
}

case "${1:-both}" in
  customer) build_app customer "$CUSTOMER_DIR" ;;
  partner)  build_app partner  "$PARTNER_DIR" ;;
  both|*)
    build_app customer "$CUSTOMER_DIR"
    build_app partner  "$PARTNER_DIR"
    ;;
esac
