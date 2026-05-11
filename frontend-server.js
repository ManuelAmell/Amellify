const express = require('express');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const PORT = process.env.PORT || 5050;
const BACKEND = process.env.BACKEND || 'http://localhost:5051';
const BACKEND_WS = process.env.BACKEND_WS || 'ws://localhost:5051';

app.use(express.static(path.join(__dirname), { index: 'index.html', extensions: ['html'] }));

app.use((req, res, next) => {
  if (!req.url.startsWith('/api')) return next();
  const url = BACKEND + req.url;
  const options = {
    method: req.method,
    headers: {}
  };
  const skipHeaders = ['host', 'connection', 'content-length', 'content-encoding'];
  for (const [k, v] of Object.entries(req.headers)) {
    if (!skipHeaders.includes(k.toLowerCase())) options.headers[k] = v;
  }

  const proxyReq = http.request(url, options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', () => res.status(502).json({ error: 'Backend unavailable' }));
  req.pipe(proxyReq);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

let backendProxy = null;
let proxyReconnectTimer = null;

function ensureBackendProxy() {
  if (backendProxy && backendProxy.readyState === 1) return backendProxy;

  if (proxyReconnectTimer) return;
  proxyReconnectTimer = setTimeout(() => { proxyReconnectTimer = null; }, 2000);

  try {
    backendProxy = new (require('ws'))(BACKEND_WS);
  } catch {
    return null;
  }

  backendProxy.on('message', (data) => {
    wss.clients.forEach((c) => {
      if (c.readyState === 1) { try { c.send(data); } catch {} }
    });
  });

  backendProxy.on('close', () => {
    backendProxy = null;
    setTimeout(() => {
      proxyReconnectTimer = null;
      ensureBackendProxy();
    }, 2000);
  });

  backendProxy.on('error', () => {
    backendProxy.close();
    backendProxy = null;
  });

  return backendProxy;
}

wss.on('connection', (ws) => {
  ensureBackendProxy();
  ws.on('message', (data) => {
    const p = ensureBackendProxy();
    if (p && p.readyState === 1) p.send(data);
  });
  ws.on('close', () => {});
});

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Frontend  -> http://0.0.0.0:${PORT}`);
  console.log(`  API       -> ${BACKEND}`);
  console.log(`  WebSocket -> ${BACKEND_WS}`);
  console.log(`  Acceso    -> http://100.101.28.97:${PORT}\n`);
});