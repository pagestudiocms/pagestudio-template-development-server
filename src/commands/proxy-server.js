/**
 * PageStudio Development Server
 * Proxies your live CMS, replaces asset URLs with local versions and provides live reload + file watching.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

// Import proxy modules
const { AssetRewriter } = require('../proxy/asset-rewriter');
const { LinkRewriter } = require('../proxy/link-rewriter');
const { injectLiveReload } = require('../proxy/html-injector');
const { setupLiveReload } = require('../proxy/live-reload');
const { createCmsProxy } = require('../proxy/proxy-middleware');

// Change this to your real CMS preview / render URL
// const CMS_URL = "http://pagestudiocms.local";
const CMS_URL = "http://ntbm.local";

async function run(options) {
  const app = express();

  const port = Number(options.port) || 8080;
  const host = options.host || "127.0.0.1";
  // Resolve localRoot relative to the calling project's working directory (CWD)
  const localRoot = path.resolve(process.cwd(), options.root); // e.g., "/path/to/project/compiled"
  const watchDirs = options.watch.split(",").map(dir => path.resolve(process.cwd(), dir.trim()));

  console.log("------------------------------------------------");
  console.log(`📦 PageStudio Dev Server`);
  console.log(`🌍 CMS Proxy URL: ${CMS_URL}`);
  console.log(`📁 Local assets folder: ${localRoot}`);
  console.log(`👀 Watching: ${watchDirs.join(", ")}`);
  console.log("------------------------------------------------");

  // Initialize rewriters
  const localServerUrl = `http://${host}:${port}`;
  const assetRewriter = new AssetRewriter(localRoot, CMS_URL);
  const linkRewriter = new LinkRewriter(CMS_URL, localServerUrl);

  app.use((req, res, next) => {
    console.log(`➡ Incoming Request: ${req.method} ${req.url}`);
    next();
  });


  /**
   * 1. Serve Local Assets
   * If /assets/* exists in your local compiled folder, serve it.
   */
  app.use("/assets", async (req, res, next) => {
    // Remove query parameters, keep the path (req.path already has /assets/ removed by Express)
    const cleanPath = req.path.replace(/^\//, '').split('?')[0];
    const localPath = path.resolve(localRoot, 'assets', cleanPath);

    // 1. LOCAL ASSET EXISTS?
    if (fs.existsSync(localPath)) {
      console.log(`🟩 Serving LOCAL asset: ${localPath}`);
      
      // Set proper MIME type based on file extension
      const ext = path.extname(localPath).toLowerCase();
      const mimeTypes = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject'
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';
      
      // Set cache-busting headers for development
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      return res.sendFile(localPath);
    }

    // 2. FALL BACK TO CMS
    console.log(`🟦 Fallback to CMS for asset: ${cleanPath}`);
    return next(); // continue to proxy
  });

  /**
   * 2. Proxy everything else to CMS
   * But intercept HTML so we can rewrite URLs + inject HMR
   */
  console.log(`🔧 Setting up proxy middleware for CMS: ${CMS_URL}`);
  
  const proxyMiddleware = createCmsProxy({
    cmsUrl: CMS_URL,
    host: host,
    assetRewriter: assetRewriter,
    linkRewriter: linkRewriter,
    injectLiveReload: injectLiveReload
  });

  app.use(
    "/",
    (req, res, next) => {
      console.log(`🎯 About to proxy: ${req.method} ${req.url}`);
      next();
    },
    proxyMiddleware
  );

  /**
   * 3. Start HTTP server
   */
  app.listen(port, host, () => {
    console.log(`🚀 Dev server running at http://${host}:${port}`);
  });

  /**
   * 4. Start live reload server
   */
  setupLiveReload(watchDirs, host, 3001);

  /**
   * 5. Optional: auto-open browser
   */
  if (options.open === "true") {
    const open = await import("open");
    open.default(`http://${host}:${port}`);
  }
}

module.exports = { run };
