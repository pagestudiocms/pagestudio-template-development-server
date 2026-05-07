/**
 * HTML Injector
 * Injects live reload script into HTML pages
 */

/**
 * Inject live reload WebSocket client script into HTML
 * @param {string} html - HTML content
 * @param {string} host - WebSocket host (default: 'localhost')
 * @param {number} wsPort - WebSocket port (default: 3001)
 * @returns {string} - HTML with injected script
 */
function injectLiveReload(html, host = "localhost", wsPort = 3001) {
  // Check if body tag exists (case-insensitive)
  if (!/<\/body>/i.test(html)) {
    console.warn('⚠️  No closing </body> tag found - skipping live reload injection');
    return html;
  }

  const script = `
    <script>
      (function() {
        console.log('🔌 Initializing live reload...');
        
        function connectWebSocket() {
          try {
            const ws = new WebSocket("ws://${host}:${wsPort}");
            
            ws.onopen = function() {
              console.log('✅ Live reload connected to ws://${host}:${wsPort}');
            };
            
            ws.onmessage = function(event) {
              if (event.data === 'reload') {
                console.log('🔄 Live reload triggered, reloading page...');
                window.location.reload();
              } else {
                console.log('📨 Received:', event.data);
              }
            };
            
            ws.onerror = function(error) {
              console.warn('❌ Live reload WebSocket error:', error);
            };
            
            ws.onclose = function(event) {
              console.log('🔌 Live reload disconnected, reconnecting in 2s...');
              setTimeout(connectWebSocket, 2000);
            };
          } catch(e) {
            console.error('❌ Live reload failed to initialize:', e);
            setTimeout(connectWebSocket, 2000);
          }
        }
        
        connectWebSocket();
      })();
    </script>
  `;
  
  // Use case-insensitive replace, only replace first occurrence
  return html.replace(/<\/body>/i, `${script}</body>`);
}

module.exports = { injectLiveReload };
