const WebSocket = require('ws');
const fs = require('fs');
const { exec } = require('child_process');

const PORT = 8089;
const wss = new WebSocket.Server({ port: PORT });
console.log(`⚡ 1-to-Many Hot Reload WebSocket Server active on port ${PORT}`);

let isBuilding = { customer: false, partner: false };
let pendingBuild = { customer: false, partner: false };

function triggerBuildAndReload(app) {
  if (isBuilding[app]) {
    pendingBuild[app] = true;
    return;
  }

  isBuilding[app] = true;
  console.log(`⚡ [${app}] Dart source change detected. Rebuilding web app...`);

  exec(`${__dirname}/build-flutter.sh ${app}`, (err, stdout, stderr) => {
    isBuilding[app] = false;
    if (err) {
      console.error(`❌ [${app}] Flutter build error:`, stderr);
    } else {
      console.log(`✓ [${app}] Rebuild complete. Broadcasting hot reload signal to all connected clients...`);
      const payload = JSON.stringify({ type: 'HOT_RELOAD', app, timestamp: Date.now() });
      let count = 0;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(payload);
          count++;
        }
      });
      console.log(`⚡ Broadcasted HOT_RELOAD to ${count} connected browsers for app: ${app}`);
    }

    if (pendingBuild[app]) {
      pendingBuild[app] = false;
      triggerBuildAndReload(app);
    }
  });
}

// Watch customer app source
let customerDebounce = null;
fs.watch(`${__dirname}/apps/mobile/customer/lib`, { recursive: true }, (evt, filename) => {
  if (filename && filename.endsWith('.dart')) {
    clearTimeout(customerDebounce);
    customerDebounce = setTimeout(() => triggerBuildAndReload('customer'), 300);
  }
});

// Watch delivery partner app source
let partnerDebounce = null;
fs.watch(`${__dirname}/apps/mobile/delivery/lib`, { recursive: true }, (evt, filename) => {
  if (filename && filename.endsWith('.dart')) {
    clearTimeout(partnerDebounce);
    partnerDebounce = setTimeout(() => triggerBuildAndReload('partner'), 300);
  }
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'CONNECTED', serverTime: Date.now() }));
});
