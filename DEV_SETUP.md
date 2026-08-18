# F2H Fresh — Complete Dev Environment Guide

## Architecture Overview

```
SSH Dev Machine
│
├─ PM2 (always-on, auto-restart)
│   ├─ api-f2hfresh     → NestJS + SWC watch  → :5001
│   └─ frontend-f2hfresh→ Next.js Turbopack   → :5002
│
├─ Flutter (run manually via ./dev-flutter.sh)
│   ├─ Customer app     → flutter run web-server → :8081
│   └─ Delivery/Partner → flutter run web-server → :8082
│
└─ Nginx (proxies to domains, zero caching)
    ├─ https://f2hfresh.com          → :5001 (API) + :5002 (Next.js)
    ├─ https://customer.f2hfresh.com → :8081 (Flutter Customer)
    └─ https://partner.f2hfresh.com  → :8082 (Flutter Delivery)
```

---

## Quick Start

### 1. Start Node apps (already running via PM2 on boot)
```bash
cd /home/f2hfresh/htdocs/f2hfresh.com
pm2 start ecosystem.dev.config.cjs  # first time only
pm2 status                           # check health
```

### 2. Start Flutter dev servers
```bash
cd /home/f2hfresh/htdocs/f2hfresh.com
./dev-flutter.sh          # starts both Customer (:8081) + Partner (:8082)
./dev-flutter.sh customer # start only customer app
./dev-flutter.sh partner  # start only partner/delivery app
./dev-flutter.sh stop     # stop all flutter servers
./dev-flutter.sh status   # check which are running
```

---

## Live Reload Behaviour

| App | Technology | How fast | Trigger |
|-----|-----------|----------|---------|
| NestJS API | SWC `--watch` | ~200-400ms | Save any `.ts` file |
| Next.js web | Turbopack HMR | ~100-300ms | Save any `.tsx/.css` |
| Flutter Customer | `flutter run --debug` | ~1-2s hot reload | Press `r` in terminal |
| Flutter Partner | `flutter run --debug` | ~1-2s hot reload | Press `r` in terminal |

### ⚡ Quick Start Make Commands

You can run any server with simple `make` commands from the workspace root:

```bash
cd /home/f2hfresh/htdocs/f2hfresh.com

# 1. Run Customer App (flutter run on port 8081)
make customer

# 2. Run Delivery Partner App (flutter run on port 8082)
make partner

# 3. Stop running servers & free ports 8081/8082
make stop

# 4. View all available make targets
make help
```

---

## PM2 Commands (Node Services)

```bash
pm2 status                          # overview of all processes
pm2 logs api-f2hfresh --lines 50    # NestJS tail logs
pm2 logs frontend-f2hfresh --lines 50 # Next.js tail logs
pm2 restart api-f2hfresh            # restart API
pm2 restart frontend-f2hfresh       # restart frontend
pm2 restart all                     # restart everything
```

---

## Log Files

| Service | Log Path |
|---------|----------|
| NestJS stdout | `/home/f2hfresh/logs/pm2/api-out.log` |
| NestJS stderr | `/home/f2hfresh/logs/pm2/api-err.log` |
| Next.js stdout | `/home/f2hfresh/logs/pm2/frontend-out.log` |
| Flutter Customer | `/home/f2hfresh/logs/flutter/customer.log` |
| Flutter Partner | `/home/f2hfresh/logs/flutter/partner.log` |
| Nginx dev | `/home/f2hfresh/logs/nginx/error.log` |
| Nginx customer | `/home/f2hfresh-customer/logs/nginx/error.log` |
| Nginx partner | `/home/f2hfresh-partner/logs/nginx/error.log` |

---

## Port Reference

| Port | Service |
|------|---------|
| 5001 | NestJS API |
| 5002 | Next.js (Turbopack) |
| 5432 | PostgreSQL (f2h_fresh DB) |
| 8081 | Flutter Customer web-server |
| 8082 | Flutter Partner/Delivery web-server |

---

## API Endpoints

All API calls go through: `https://f2hfresh.com/api/v1/...`

Flutter apps auto-use this URL from `ApiEndpoints._devBaseUrl`.
No env changes needed for standard dev work.

---

## Building for Production (Flutter Web)

```bash
# From repo root
npm run deploy:customer-web  # build + copy to /home/f2hfresh-customer/htdocs/
npm run deploy:partner-web   # build + copy to /home/f2hfresh-partner/htdocs/
```

---

## Database (Adminer)

Access: **https://db.f2hfresh.com**
- System: PostgreSQL
- Server: `localhost`
- Username: `f2h_user`
- Password: `f2h_password`
- Database: `f2h_fresh`

---

## Troubleshooting

### API not reloading on save?
```bash
pm2 logs api-f2hfresh --lines 20  # check for compile errors
pm2 restart api-f2hfresh
```

### Flutter app shows old code in browser?
- Hard refresh: `Ctrl+Shift+R` (cache disabled at Nginx level)
- Or press `R` (capital) in the flutter console for full hot-restart

### Port already in use?
```bash
lsof -i :8081   # find what's using port 8081
./dev-flutter.sh stop && ./dev-flutter.sh  # restart flutter
```

### PM2 not starting on boot?
```bash
pm2 startup    # generates the startup command
pm2 save       # saves current process list
```
