// Minimaler statischer Server für die E2E-Tests (ohne Abhängigkeiten). Liefert das Projekt unter /Lisas-Trainingsapp/.
// Optional: LISA_OVERLAY_DIR – Dateien daraus ersetzen data/<name>.json (nur für Entwicklung, solange Inhalte fehlen).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BASE = '/Lisas-Trainingsapp/';
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

export function start() {
  const overlay = process.env.LISA_OVERLAY_DIR || '';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (!p.startsWith(BASE)) { res.writeHead(404); res.end('not found'); return; }
    p = p.slice(BASE.length) || 'index.html';
    let file = path.join(ROOT, p);
    if (overlay && p.startsWith('data/') && fs.existsSync(path.join(overlay, path.basename(p)))) file = path.join(overlay, path.basename(p));
    if (!file.startsWith(ROOT) && !(overlay && file.startsWith(overlay))) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ server, url: `http://127.0.0.1:${server.address().port}${BASE}`, close: () => new Promise((r) => server.close(r)) });
  }));
}
