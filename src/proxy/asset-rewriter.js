/**
 * Asset URL Rewriter
 * Rewrites CSS and JS URLs to point to local files when available
 * Handles multiple asset path patterns:
 * - /assets/...
 * - /static/.../assets/...
 */

const fs = require('fs');
const path = require('path');

class AssetRewriter {
  /**
   * Create a new AssetRewriter
   * @param {string} localRoot - Local root directory (e.g., 'compiled')
   * @param {string} cmsUrl - CMS URL to match against
   */
  constructor(localRoot, cmsUrl) {
    this.localRoot = localRoot;
    this.cmsUrl = cmsUrl;
    this.cmsUrlEscaped = cmsUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Rewrite asset URLs in HTML
   * @param {string} html - HTML content
   * @returns {string} - HTML with rewritten URLs
   */
  rewrite(html) {
    let rewriteCount = 0;
    
    // Pattern 1: /assets/... (direct assets folder)
    html = this._rewritePattern(html, /href="([^"]*\/assets\/[^"]+)"/g, 'href', rewriteCount);
    html = this._rewritePattern(html, /src="([^"]*\/assets\/[^"]+)"/g, 'src', rewriteCount);
    
    // Pattern 2: /static/.../assets/... (nested in static folder)
    html = this._rewritePattern(html, /href="([^"]*\/static\/[^"]*\/assets\/[^"]+)"/g, 'href', rewriteCount);
    html = this._rewritePattern(html, /src="([^"]*\/static\/[^"]*\/assets\/[^"]+)"/g, 'src', rewriteCount);

    return html;
  }

  /**
   * Helper to rewrite a specific URL pattern
   * @private
   */
  _rewritePattern(html, regex, attr, rewriteCount) {
    return html.replace(regex, (match, assetPath) => {
      // Remove query parameters
      const cleanUrl = assetPath.split('?')[0];
      
      // Extract just the /assets/... part (handles both /assets/... and /static/.../assets/...)
      const assetsMatch = cleanUrl.match(/\/assets\/(.+)$/);
      if (!assetsMatch) {
        return match; // Doesn't match expected pattern
      }

      const assetRelPath = assetsMatch[1]; // e.g., "css/style.css"
      const localPath = path.resolve(this.localRoot, 'assets', assetRelPath);

      if (fs.existsSync(localPath)) {
        console.log(`   ✓ Found local asset: ${assetRelPath}`);
        return `${attr}="/assets/${assetRelPath}"`; // Rewrite to local /assets/ path
      }

      return match; // Keep original (will proxy to CMS)
    });
  }
}

module.exports = { AssetRewriter };
