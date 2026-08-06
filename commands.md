# F2H Fresh — Flutter Web Apps Workflow & Commands

This guide explains how your Flutter Web apps are served on HTTPS (`https://customer.f2hfresh.com` & `https://partner.f2hfresh.com`) and how to build & deploy updates cleanly.

---

## 1. Why `flutter run -d web-server` Shows Console Errors on HTTPS

When running `flutter run -d web-server` (Debug Mode):
- The Dart Web Debug Daemon (DWDS) injects debug scripts (`client.js`, `ddc_module_loader.js`) that attempt to open **insecure WebSockets (`ws://`)** and load thousands of raw unbundled `.dart.lib.js` source files.
- Modern web browsers enforce strict HTTPS security policies and **block insecure WebSockets (`ws://`) as Mixed Content Security Errors**, causing `ERR_FAILED` and red console errors.

---

## 2. The Recommended Workflow: Fast Clean Serving

To have your web domains load instantly in **<1 second** over HTTPS with **0 console errors**:

Nginx is configured to serve compiled release web builds directly from:
- **Customer App**: `/home/f2hfresh-customer/htdocs/customer.f2hfresh.com/`
- **Partner App**: `/home/f2hfresh-partner/htdocs/partner.f2hfresh.com/`

### How to Deploy Your Changes:

Whenever you make code updates in your Flutter projects, run the deployment command:

#### Deploy Customer Web App:
```bash
cd /var/www/f2hfresh
npm run deploy:customer-web
```
*(Or directly: `cd /var/www/f2hfresh/apps/mobile/customer && flutter build web --release && cp -r build/web/* /home/f2hfresh-customer/htdocs/customer.f2hfresh.com/`)*

#### Deploy Partner Web App:
```bash
cd /var/www/f2hfresh
npm run deploy:partner-web
```
*(Or directly: `cd /var/www/f2hfresh/apps/mobile/delivery && flutter build web --release && cp -r build/web/* /home/f2hfresh-partner/htdocs/partner.f2hfresh.com/`)*

---

## 3. Quick Maintenance Commands

### Check Nginx Status & Reload
```bash
nginx -t && systemctl reload nginx
```

### Ensure Correct Permissions Across Htdocs
```bash
chmod -R 755 /home/f2hfresh-customer/htdocs/customer.f2hfresh.com
chmod -R 755 /home/f2hfresh-partner/htdocs/partner.f2hfresh.com
```
