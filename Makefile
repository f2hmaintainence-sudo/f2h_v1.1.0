.PHONY: help customer partner customer-run customer-bg customer-attach partner-run partner-bg partner-attach api web build-customer build-partner build-all dev-all stop status run dev

DART_API = https://f2hfresh.com

help:
	@echo ""
	@echo "═══════════════════════════════════════════════════════════════════════════════"
	@echo " F2H Fresh — Developer Commands"
	@echo "═══════════════════════════════════════════════════════════════════════════════"
	@echo "  make customer        - Fast build & publish Customer App (<0.1s page load)"
	@echo "  make customer-run    - Interactive Customer App dev server (press 'r' to reload)"
	@echo "  make customer-bg     - Background Customer App dev server (auto hot-reload)"
	@echo "  make customer-attach - Attach to background Customer App dev session"
	@echo "  make partner         - Fast build & publish Delivery Partner App (<0.1s page load)"
	@echo "  make partner-run     - Interactive Partner App dev server (press 'r' to reload)"
	@echo "  make partner-bg      - Background Partner App dev server (auto hot-reload)"
	@echo "  make partner-attach  - Attach to background Partner App dev session"
	@echo "  make api             - Run NestJS API backend (port 5001)"
	@echo "  make web             - Run Next.js Web frontend (port 5002)"
	@echo "  make dev-all         - Run all Flutter apps in background with Auto Hot-Reload"
	@echo "  make stop            - Stop background services"
	@echo "═══════════════════════════════════════════════════════════════════════════════"
	@echo ""

run: customer-run

customer:
	./build-flutter.sh customer

customer-run:
	@fuser -k -9 8081/tcp 2>/dev/null || true
	cd apps/mobile/customer && flutter run --debug -d web-server --web-port=8081 --web-hostname=0.0.0.0 --dart-define=F2H_API_BASE_URL=$(DART_API)

customer-dev: customer-run

customer-bg:
	./dev-flutter.sh customer

customer-attach:
	tmux -S /tmp/f2h-tmux.sock attach -t flutter_customer

partner:
	./build-flutter.sh partner

partner-run:
	@fuser -k -9 8082/tcp 2>/dev/null || true
	cd apps/mobile/delivery && flutter run --debug -d web-server --web-port=8082 --web-hostname=0.0.0.0 --dart-define=F2H_API_BASE_URL=$(DART_API)

partner-dev: partner-run

partner-bg:
	./dev-flutter.sh partner

partner-attach:
	tmux -S /tmp/f2h-tmux.sock attach -t flutter_delivery

dev-all:
	./dev-flutter.sh both

api:
	cd apps/api && npm run start:dev

web:
	cd apps/web && npm run dev

build-customer: customer

build-partner: partner

build-all:
	./build-flutter.sh both

stop:
	./dev-flutter.sh stop
	@fuser -k -9 8081/tcp 8082/tcp 2>/dev/null || true
	@pkill -9 -f "flutter.*web-server" 2>/dev/null || true
	@pkill -9 -f "dart.*web-server" 2>/dev/null || true
	@echo "✓ Stopped Flutter processes."


