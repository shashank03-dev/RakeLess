/** Local server: the same Web handlers Vercel runs, on loopback. Serves dist/ when NODE_ENV=production. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { analyze, getExample, health } from './handlers.js';
import { currentProvider } from './inference.js';

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || '127.0.0.1';
const PROD = process.env.NODE_ENV === 'production';
const DIST = path.resolve('dist');
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon' };

async function route(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  if (pathname === '/api/health' && req.method === 'GET') return health();
  if (pathname === '/api/analyze') return analyze(req);
  const ex = pathname.match(/^\/api\/examples\/([a-z0-9-]+)$/);
  if (ex && req.method === 'GET') return getExample(ex[1]);
  if (pathname.startsWith('/api/')) return new Response(JSON.stringify({ error: 'Not found.' }), { status: 404, headers: { 'content-type': 'application/json' } });
  if (!PROD) return new Response('API only; run Vite for the UI.', { status: 404 });
  const file = path.join(DIST, path.normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  const target = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile() ? file : path.join(DIST, 'index.html');
  return new Response(fs.readFileSync(target), { headers: { 'content-type': TYPES[path.extname(target)] || 'application/octet-stream' } });
}

const MAX_BODY = 9 * 1024 * 1024;

http
  .createServer(async (req, res) => {
    const url = `http://${req.headers.host}${req.url}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    // The rate limiter keys on this; a client-sent copy is never trusted.
    headers.set('x-rakeless-peer', req.socket.remoteAddress || 'unknown');
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    if (hasBody && Number(req.headers['content-length'] || 0) > MAX_BODY) {
      res.writeHead(413, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Image is larger than 8 MB.' }));
      req.resume();
      return;
    }
    // Abort upstream model work if the browser goes away.
    const ctrl = new AbortController();
    res.on('close', () => { if (!res.writableFinished) ctrl.abort(); });
    let seen = 0;
    const body = hasBody
      ? (Readable.toWeb(req) as ReadableStream<Uint8Array>).pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, c) {
            seen += chunk.byteLength;
            if (seen > MAX_BODY) c.error(new Error('body too large')); else c.enqueue(chunk);
          },
        }))
      : undefined;
    const request = new Request(url, { method: req.method, headers, body, duplex: 'half', signal: ctrl.signal } as RequestInit);
    const response = await route(request).catch(() => new Response(JSON.stringify({ error: 'Server error.' }), { status: 500, headers: { 'content-type': 'application/json' } }));
    if (res.destroyed) return;
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  })
  .listen(PORT, HOST, () => console.log(`RakeLess ${PROD ? 'app' : 'API'} on http://${HOST}:${PORT} · provider: ${currentProvider().label} (${currentProvider().modelName})`));
