/**
 * Serves the built single-page app from STATIC_DIR with security headers.
 * Hashed assets are cached for a year; index.html is never cached. Unknown
 * non-API paths fall back to index.html so client-side routes work.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

/** Content Security Policy for the app. No third-party origins; fonts are self-hosted. */
export const PAGE_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // inline style attributes are used for layout tweaks and Radix positioning
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');

export function pageHeaders(https: boolean): Record<string, string> {
  return {
    'Content-Security-Policy': PAGE_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    ...(https ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
  };
}

export function createStaticHandler(root: string, https: boolean) {
  const resolvedRoot = path.resolve(root);
  const indexFile = path.join(resolvedRoot, 'index.html');
  return function serveStatic(req: IncomingMessage, res: ServerResponse): void {
    const method = req.method ?? 'GET';
    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = path.join(resolvedRoot, pathname);
    if (!file.startsWith(resolvedRoot + path.sep) && file !== resolvedRoot) {
      res.writeHead(403).end();
      return;
    }
    let isIndex = false;
    if (!existsSync(file) || !statSync(file).isFile()) {
      // Missing asset files are a real 404; everything else is a client route.
      if (path.extname(pathname) && pathname.startsWith('/assets/')) {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
        return;
      }
      file = indexFile;
      isIndex = true;
    }
    if (!existsSync(file)) {
      res.writeHead(503, { 'Content-Type': 'text/plain' }).end('The web app has not been built. Run pnpm build.');
      return;
    }
    const ext = path.extname(file);
    const immutable = !isIndex && pathname.startsWith('/assets/');
    res.writeHead(200, {
      ...pageHeaders(https),
      'Content-Type': TYPES[ext] ?? 'application/octet-stream',
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Content-Length': statSync(file).size,
    });
    if (method === 'HEAD') res.end();
    else createReadStream(file).pipe(res);
  };
}
