/**
 * Live Reload Service
 * WebSocket server for live reload functionality with file watching
 */

const chokidar = require('chokidar');
const WebSocket = require('ws');

/**
 * Setup live reload WebSocket server and file watcher
 * @param {string[]} watchDirs - Directories to watch for changes
 * @param {string} host - Host to display in logs
 * @param {number} wsPort - WebSocket port (default: 3001)
 * @returns {WebSocket.Server} - WebSocket server instance
 */
function setupLiveReload(watchDirs, host, wsPort = 3001) {
  console.log(`🔧 Setting up WebSocket server on port ${wsPort}...`);
  
  const wss = new WebSocket.Server({ 
    port: wsPort,
    host: '0.0.0.0' // Listen on all interfaces
  });

  wss.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${wsPort} is already in use. Please kill the existing process or change the port.`);
      process.exit(1);
    } else {
      console.error(`❌ WebSocket server error: ${err.message}`);
    }
  });

  wss.on('listening', () => {
    console.log(`🔁 Live reload WebSocket listening at ws://${host}:${wsPort}`);
  });

  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`🔌 Live reload client connected from ${clientIp} (${wss.clients.size} total)`);
    
    ws.on('close', () => {
      console.log(`🔌 Live reload client disconnected (${wss.clients.size} remaining)`);
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket client error: ${error.message}`);
    });

    // Send a welcome message
    ws.send('connected');
  });

  chokidar
    .watch(watchDirs, { 
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })
    .on("all", (event, filePath) => {
      console.log(`🔄 File ${event}: ${filePath}`);
      console.log(`📢 Broadcasting reload to ${wss.clients.size} client(s)`);
      
      let successCount = 0;
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.send("reload");
            successCount++;
          } catch (error) {
            console.error(`❌ Failed to send to client: ${error.message}`);
          }
        }
      });
      
      console.log(`✅ Sent reload to ${successCount} client(s)`);
    });

  console.log(`👀 Watching directories: ${watchDirs.join(", ")}`);
  
  return wss;
}

module.exports = { setupLiveReload };
