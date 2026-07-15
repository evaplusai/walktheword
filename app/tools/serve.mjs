// Tiny static server for the app (no dependencies).
// Run: npm run serve            -> http://localhost:7317
//      npm run serve -- 9000    -> custom port
// Default 7317 chosen to avoid common dev ports (3000/5173/8000/8080).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const port = Number(process.argv[2]) || 7317;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8'
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let path = normalize(url.pathname).replace(/^(\.\.[/\\])+/, '');
    if (path === '/' || path === '\\') path = '/index.html';
    const file = await readFile(join(root, path));
    res.writeHead(200, { 'content-type': types[extname(path)] || 'application/octet-stream' });
    res.end(file);
  } catch {
    res.writeHead(404); res.end('not found');
  }
}).listen(port, () => console.log(`walktheword: http://localhost:${port}`));
