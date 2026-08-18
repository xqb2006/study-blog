/**
 * CMS Server
 *
 * Hono-based server that provides both API routes and serves the Vite dev frontend.
 */

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import yaml from 'js-yaml';
import { createServer as createViteServer } from 'vite';

import {
  buildStatusHandler,
  createHandler,
  deleteHandler,
  deleteMediaHandler,
  getSiteSettingsHandler,
  importMarkdownHandler,
  listHandler,
  listMediaHandler,
  listMediaTrashHandler,
  listTrashHandler,
  ogCacheHandler,
  ogDataHandler,
  readHandler,
  rebuildBlogHandler,
  purgeMediaTrashHandler,
  purgeTrashHandler,
  restoreMediaTrashHandler,
  restoreTrashHandler,
  saveSiteSettingsHandler,
  toggleDraftHandler,
  toggleStickyHandler,
  uploadMediaHandler,
  writeHandler,
} from './src/api';
import { setCategoryMap } from './src/lib/category';
import { CMS_PORT } from './src/lib/config';

// Type for Hono context variables
type AppVariables = {
  projectRoot: string;
};

// Load project configuration
const CMS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(CMS_DIR, '..');

// Load site config for category map
function loadSiteConfig() {
  const configPath = path.join(PROJECT_ROOT, 'config', 'site.yaml');
  if (!fs.existsSync(configPath)) {
    console.warn('[CMS] config/site.yaml not found');
    return {};
  }
  const content = fs.readFileSync(configPath, 'utf-8');
  return yaml.load(content) as Record<string, unknown>;
}

function getContentType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    '.avif': 'image/avif',
    '.css': 'text/css; charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html; charset=utf-8',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return contentTypes[extension] || 'application/octet-stream';
}

function servePublicStatic(url: string, res: http.ServerResponse): boolean {
  // CMS frontend loads shared blog public assets (avatar/cover/fonts).
  // Only allow a small safe allowlist so SPA fallback never swallows these paths.
  if (!url.startsWith('/img/') && !url.startsWith('/fonts/')) {
    return false;
  }

  try {
    const pathname = decodeURIComponent(url.split('?')[0] || '');
    const publicRoot = path.resolve(PROJECT_ROOT, 'public');
    const assetPath = path.resolve(publicRoot, pathname.replace(/^\//, ''));

    if (!assetPath.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(assetPath)) {
      res.statusCode = 404;
      res.end('Not found');
      return true;
    }

    const stat = fs.statSync(assetPath);
    if (!stat.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return true;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(assetPath));
    res.setHeader(
      'Cache-Control',
      pathname.startsWith('/fonts/')
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60',
    );
    fs.createReadStream(assetPath).pipe(res);
    return true;
  } catch (error) {
    console.error('[CMS] Failed to serve public static asset:', error);
    res.statusCode = 500;
    res.end('Internal server error');
    return true;
  }
}

function serveBuiltCmsAsset(url: string, res: http.ServerResponse): boolean {
  const staticRoot = path.resolve(CMS_DIR, 'dist');
  const indexPath = path.join(staticRoot, 'index.html');

  if (!fs.existsSync(indexPath)) {
    return false;
  }

  try {
    const pathname = decodeURIComponent(url.split('?')[0] || '/');
    const requestedPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
    let assetPath = path.resolve(staticRoot, requestedPath);

    if (!assetPath.startsWith(`${staticRoot}${path.sep}`) && assetPath !== staticRoot) {
      res.statusCode = 403;
      res.end('Forbidden');
      return true;
    }

    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
      assetPath = indexPath;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', getContentType(assetPath));
    res.setHeader(
      'Cache-Control',
      assetPath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
    );
    fs.createReadStream(assetPath).pipe(res);
    return true;
  } catch (error) {
    console.error('[CMS] Failed to serve built CMS asset:', error);
    res.statusCode = 500;
    res.end('Internal server error');
    return true;
  }
}

async function main() {
  const siteConfig = loadSiteConfig();

  // Set category map from config
  const categoryMap = (siteConfig.categoryMap as Record<string, string>) || {};
  setCategoryMap(categoryMap);

  // Create Hono app for API routes
  const app = new Hono<{ Variables: AppVariables }>();

  // Middleware
  app.use('*', logger());
  app.use('*', cors());

  // Security: localhost-only and optional API key authentication
  const CMS_API_KEY = process.env.CMS_API_KEY;
  app.use('/api/*', async (c, next) => {
    // Validate Host header to prevent DNS rebinding attacks
    const host = c.req.header('host') || '';
    const allowedHosts = new Set([
    ]);
    const isAllowedHost = /^(localhost|127\.0\.0\.1|::1)(:\d+)?$/.test(host) || allowedHosts.has(host);
    if (!isAllowedHost) {
      return c.json({ error: 'CMS is only accessible from allowed hosts' }, 403);
    }

    // Optional API key authentication
    if (CMS_API_KEY) {
      const authHeader = c.req.header('authorization');
      const providedKey = authHeader?.replace('Bearer ', '');
      if (providedKey !== CMS_API_KEY) {
        return c.json({ error: 'Invalid or missing API key' }, 401);
      }
    }

    await next();
  });

  // Inject project root into context
  app.use('*', async (c, next) => {
    c.set('projectRoot', PROJECT_ROOT);
    await next();
  });

  // API routes
  app.get('/api/cms/list', listHandler);
  app.get('/api/cms/read', readHandler);
  app.post('/api/cms/write', writeHandler);
  app.post('/api/cms/create', createHandler);
  app.post('/api/cms/import-markdown', importMarkdownHandler);
  app.post('/api/cms/delete', deleteHandler);
  app.post('/api/cms/toggle-draft', toggleDraftHandler);
  app.post('/api/cms/toggle-sticky', toggleStickyHandler);
  app.get('/api/cms/og-data', ogDataHandler);
  app.get('/api/cms/og-cache', ogCacheHandler);
  app.get('/api/cms/site-settings', getSiteSettingsHandler);
  app.post('/api/cms/site-settings', saveSiteSettingsHandler);
  app.get('/api/cms/media', listMediaHandler);
  app.post('/api/cms/media/upload', uploadMediaHandler);
  app.post('/api/cms/media/delete', deleteMediaHandler);
  app.get('/api/cms/media/trash', listMediaTrashHandler);
  app.post('/api/cms/media/trash/restore', restoreMediaTrashHandler);
  app.post('/api/cms/media/trash/purge', purgeMediaTrashHandler);
  app.get('/api/cms/build/status', buildStatusHandler);
  app.post('/api/cms/build/rebuild', rebuildBlogHandler);
  app.get('/api/cms/trash', listTrashHandler);
  app.post('/api/cms/trash/restore', restoreTrashHandler);
  app.post('/api/cms/trash/purge', purgeTrashHandler);

  // Config endpoint - returns project configuration for client use
  app.get('/api/cms/config', (c) => {
    return c.json({
      projectRoot: PROJECT_ROOT,
      contentDir: 'src/content/blog',
      categoryMap,
    });
  });

  const hasBuiltCmsFrontend = fs.existsSync(path.join(CMS_DIR, 'dist', 'index.html'));
  const vite = hasBuiltCmsFrontend
    ? null
    : await createViteServer({
        root: CMS_DIR,
        server: {
          middlewareMode: true,
        },
        appType: 'spa',
      });

  // Create native Node.js HTTP server
  const server = http.createServer(async (req, res) => {
    const url = req.url || '/';

    // Route API requests to Hono
    if (url.startsWith('/api/')) {
      // Convert Node.js IncomingMessage to Web ReadableStream for request body
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const body = hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined;

      const response = await app.fetch(
        new Request(`http://localhost${url}`, {
          method: req.method,
          headers: req.headers as HeadersInit,
          body,
          // @ts-expect-error - duplex is required for streaming body
          duplex: 'half',
        }),
      );

      // Send Hono response back
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      if (response.body) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
      }
      res.end();
      return;
    }

    if (servePublicStatic(url, res)) {
      return;
    }

    if (serveBuiltCmsAsset(url, res)) {
      return;
    }

    if (vite) {
      vite.middlewares(req, res);
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  });

  console.log(`\n[CMS] running at http://localhost:${CMS_PORT}\n`);

  server.listen(CMS_PORT);
}

main().catch(console.error);
