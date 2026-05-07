/**
 * Link Rewriter
 * Rewrites internal CMS links to point to local development server
 */

class LinkRewriter {
  /**
   * Create a new LinkRewriter
   * @param {string} cmsUrl - CMS URL to match against (e.g., 'http://pagestudiocms.local')
   * @param {string} localServerUrl - Local server URL (e.g., 'http://127.0.0.1:9000')
   */
  constructor(cmsUrl, localServerUrl) {
    this.cmsUrl = cmsUrl;
    this.localServerUrl = localServerUrl;
    this.cmsUrlEscaped = cmsUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    this.cmsHost = cmsUrl.replace(/^https?:\/\//, '');
  }

  /**
   * Rewrite internal links in HTML
   * @param {string} html - HTML content
   * @returns {string} - HTML with rewritten links
   */
  rewrite(html) {
    let linkCount = 0;
    
    // Rewrite <a> tags with absolute CMS URLs to use local server
    html = html.replace(
      new RegExp(`href="${this.cmsUrlEscaped}([^"]*)"`, 'g'),
      (match, path) => {
        linkCount++;
        return `href="${this.localServerUrl}${path}"`;
      }
    );

    // Also rewrite protocol-relative and http/https variations
    html = html.replace(
      new RegExp(`href="(?:https?:)?//${this.cmsHost}([^"]*)"`, 'g'),
      (match, path) => {
        linkCount++;
        return `href="${this.localServerUrl}${path}"`;
      }
    );

    if (linkCount > 0) {
      console.log(`   🔗 Rewrote ${linkCount} internal link(s) to local server`);
    }

    return html;
  }
}

module.exports = { LinkRewriter };
