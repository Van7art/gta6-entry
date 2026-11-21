// Shared CDP helper: static server + headless-shell browser + evaluate/screenshot.
// All fresh code for this entry's own probe harness.
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname } from 'node:path';

export const CHROME = process.env.CHROME_PATH ||
  `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

export function serve(root, port) {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/game/index.html';
      const file = join(root, p);
      if (!existsSync(file) || !file.startsWith(root)) { res.writeHead(404); res.end('nf'); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
      res.end(data);
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

export async function launchBrowser(port, url) {
  const chrome = spawn(CHROME, [
    '--headless', '--no-sandbox', '--disable-gpu', '--mute-audio',
    `--remote-debugging-port=${port}`, '--window-size=1280,800',
    '--hide-scrollbars', url,
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  chrome.stderr.on('data', (d) => { out += d; });
  const wsUrl = await new Promise((resolve, reject) => {
    const t0 = Date.now();
    const tick = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json`);
        const list = await res.json();
        const page = list.find((t) => t.type === 'page');
        if (page) return resolve(page.webSocketDebuggerUrl);
      } catch (e) { /* not up yet */ }
      if (Date.now() - t0 > 20000) return reject(new Error('devtools timeout: ' + out.slice(-500)));
      setTimeout(tick, 200);
    };
    tick();
  });
  return { chrome, wsUrl };
}

export function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const api = {
    events,
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const mid = ++id;
        pending.set(mid, { resolve, reject });
        ws.send(JSON.stringify({ id: mid, method, params }));
      });
    },
    async eval(expr) {
      const r = await api.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 400) + ' :: ' + expr.slice(0, 120));
      return r.result ? r.result.value : undefined;
    },
    async waitFor(expr, timeoutMs = 15000) {
      const t0 = Date.now();
      for (;;) {
        try {
          if (await api.eval(expr)) return true;
        } catch (e) { /* page not ready */ }
        if (Date.now() - t0 > timeoutMs) throw new Error('waitFor timeout: ' + expr);
        await new Promise((r) => setTimeout(r, 200));
      }
    },
    async shot() {
      const r = await api.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 });
      return Buffer.from(r.data, 'base64');
    },
    close() { try { ws.close(); } catch (e) { /* ignore */ } },
  };
  ws.onmessage = (msg) => {
    const d = JSON.parse(msg.data);
    if (d.id && pending.has(d.id)) {
      const p = pending.get(d.id);
      pending.delete(d.id);
      if (d.error) p.reject(new Error(d.error.message));
      else p.resolve(d.result);
    } else if (d.method) {
      events.push(d);
    }
  };
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(api);
    ws.onerror = (e) => reject(new Error('ws error ' + String(e)));
  });
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
