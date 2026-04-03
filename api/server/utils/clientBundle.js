const fs = require('fs');
const path = require('path');
const { logger } = require('@librechat/data-schemas');

/**
 * Loads SPA index.html from the client dist directory, or a dev placeholder when missing.
 * @param {string} distDir
 * @returns {{ html: string; isPlaceholder: boolean }}
 */
function loadIndexHtml(distDir) {
  const indexPath = path.join(distDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return {
      html: fs.readFileSync(indexPath, 'utf8'),
      isPlaceholder: false,
    };
  }

  logger.warn(
    `[Startup] Missing client bundle at ${indexPath}. Use \`npm run frontend:dev\` (UI at http://localhost:3090) or \`npm run build:client\`, then restart.`,
  );

  const placeholder = `<!DOCTYPE html>
<html lang="en-US">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LibreChat</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.5; }
    code { background: #f2f2f2; padding: 0.15rem 0.35rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Client UI is not built</h1>
  <p>The API is running, but <code>index.html</code> was not found under the client distribution path.</p>
  <p>From the repo root, start the Vite dev server: <code>npm run frontend:dev</code> — then open <a href="http://localhost:3090">http://localhost:3090</a>.</p>
  <p>Or build the production bundle: <code>npm run build:client</code>.</p>
</body>
</html>`;

  return { html: placeholder, isPlaceholder: true };
}

/**
 * Serves static files only when the directory exists (avoids express-static errors in dev).
 * @param {import('express').Express} app
 * @param {(p: string) => import('express').RequestHandler} staticCache
 * @param {string} [dirPath]
 */
function mountStaticIfExists(app, staticCache, dirPath) {
  if (!dirPath) {
    return;
  }
  if (!fs.existsSync(dirPath)) {
    logger.warn(`[static] Skipping missing path: ${dirPath}`);
    return;
  }
  app.use(staticCache(dirPath));
}

module.exports = { loadIndexHtml, mountStaticIfExists };
