/**
 * Proxy Middleware
 * Creates and configures the proxy middleware for CMS requests
 */

const { createProxyMiddleware } = require('http-proxy-middleware');

/**
 * Create proxy middleware with custom response handling
 * @param {object} config - Configuration object
 * @param {string} config.cmsUrl - CMS URL to proxy to
 * @param {string} config.host - Local server host
 * @param {AssetRewriter} config.assetRewriter - Asset rewriter instance
 * @param {LinkRewriter} config.linkRewriter - Link rewriter instance
 * @param {Function} config.injectLiveReload - Live reload injection function
 * @returns {Function} - Express middleware
 */
function createCmsProxy(config) {
  const { cmsUrl, host, assetRewriter, linkRewriter, injectLiveReload } = config;

  return createProxyMiddleware({
    target: cmsUrl,
    changeOrigin: true,
    selfHandleResponse: true,
    logger: console,
    on: {
      proxyReq: (proxyReq, req, res) => {
        console.log(`🔌 Proxying: ${req.method} ${req.url} → ${cmsUrl}`);
        // Remove accept-encoding to prevent compressed responses
        // We need plain text to modify HTML
        proxyReq.removeHeader('accept-encoding');
      },
      proxyRes: async (proxyRes, req, res) => {
        console.log(`📥 onProxyRes triggered for ${req.url}`);
        let body = Buffer.from([]);

        proxyRes.on("data", (chunk) => {
          body = Buffer.concat([body, chunk]);
        });

        proxyRes.on("error", (err) => {
          console.error(`❌ Stream error: ${err.message}`);
          if (!res.headersSent) {
            res.status(500).send("Proxy stream error");
          }
        });

        proxyRes.on("end", () => {
          try {
            console.log(`⬅ Response from CMS: ${proxyRes.statusCode} ${req.url}`);
            const contentType = proxyRes.headers["content-type"] || "";

            // Copy all headers EXCEPT content-length and content-encoding
            Object.keys(proxyRes.headers).forEach(key => {
              const lowerKey = key.toLowerCase();
              if (lowerKey !== 'content-length' && lowerKey !== 'content-encoding') {
                res.setHeader(key, proxyRes.headers[key]);
              }
            });

            // Set status code
            res.statusCode = proxyRes.statusCode;

            // Only rewrite HTML
            if (contentType.includes("text/html")) {
              console.log(`🔧 Rewriting HTML for ${req.url}`);
              let html = body.toString("utf8");

              // Debug: Show what asset URLs are in the HTML
              if (req.url === '/') {
                const assetMatches = html.match(/(href|src)="\/[^"]*\.(css|js)[^"]*"/g);
                if (assetMatches) {
                  console.log(`   🔍 Found ${assetMatches.length} CSS/JS URLs in HTML:`);
                  assetMatches.slice(0, 5).forEach(m => console.log(`      ${m}`));
                  if (assetMatches.length > 5) console.log(`      ... and ${assetMatches.length - 5} more`);
                }
              }

              // Replace CSS/JS URLs with local versions if available
              html = assetRewriter.rewrite(html);
              console.log(`🔧 Asset URLs rewritten for ${req.url}`);

              // Rewrite internal links to point to local dev server
              html = linkRewriter.rewrite(html);

              // Inject Live Reload script
              html = injectLiveReload(html, host);

              // Update content-length since we modified the HTML
              res.setHeader("content-length", Buffer.byteLength(html));
              res.end(html);
              console.log(`✅ Sent HTML response for ${req.url}`);
              return;
            }

            // Return non-HTML content as-is
            console.log(`📦 Sending non-HTML response (${contentType}) for ${req.url}`);
            res.setHeader("content-length", body.length);
            res.end(body);
          } catch (error) {
            console.error(`❌ Error in onProxyRes end handler: ${error.message}`);
            if (!res.headersSent) {
              res.status(500).send("Internal server error");
            }
          }
        });
      },
      error: (err, req, res) => {
        console.error(`❌ Proxy Error: ${err.message}`);
        console.error(`📍 Target URL: ${cmsUrl}`);
        console.error(`🔗 Requested path: ${req.url}`);

        if (!res.headersSent) {
          res.status(502).send(`
            <html>
              <head><title>Proxy Error</title></head>
              <body>
                <h1>Development Server - Proxy Error</h1>
                <p><strong>Cannot connect to CMS:</strong> ${cmsUrl}</p>
                <p><strong>Error:</strong> ${err.message}</p>
                <p><strong>Requested path:</strong> ${req.url}</p>
                <hr>
                <p>Please check that:</p>
                <ul>
                  <li>The CMS URL is correct in proxy-server.js</li>
                  <li>The CMS server is running and accessible</li>
                  <li>Your network connection is working</li>
                </ul>
              </body>
            </html>
          `);
        }
      }
    }
  });
}

module.exports = { createCmsProxy };
