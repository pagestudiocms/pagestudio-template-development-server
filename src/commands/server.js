/*!
 * Server Command
 * Starts the development server with live reload
 */

"use strict";

const chalk = require('chalk');
const liveServer = require("live-server");
const fs = require('fs');
const path = require("path");

/**
 * Run the development server
 * @param {object} options - Command options
 */
exports.run = (options) => {
  const meta = {
    VERSION: options.version || 'unknown',
    PUBLISHER: 'PageStudioCMS',
    YEAR: '2025',
  };

  const webroot = path.resolve(process.cwd(), options.root);
  const watchDirectories = options.watch.split(',').map(dir => dir.trim());
  const openBrowser = options.open === 'true' || options.open === true;
  const ignore = 'app,bin,build,etc,example,lib,node_modules,src,var';

  // Preflight checks
  if (!fs.existsSync(webroot)) {
    throw new Error(`Invalid value for option '--root'. The specified path "${webroot}" does not exist.`);
  }

  // Print startup message
  const asciiArt = `
   ____                           ____    _                 _   _ 
  |  _ \\    __ _    __ _    ___  / ___|  | |_   _   _    __| | (_)   ___  
  | |_) |  / _\` |  / _\` |  / _ \\ \\___ \\  | __| | | | |  / _\` | | |  / _ \\ 
  |  __/  | (_| | | (_| | |  __/  ___) | | |_  | |_| | | (_| | | | | (_) |
  |_|      \\__,_|  \\__, |  \\___| |____/   \\__|  \\__,_|  \\__,_| |_|  \\___/ 
                    |___/                                 
                                            © ${meta.YEAR} ${meta.PUBLISHER}
                                            ${chalk.cyan(`Local Development Environment`)}
                                            ${chalk.magenta('Version')} ${chalk.magenta(meta.VERSION)}\n\n`;

  console.log(chalk.green(`Starting Development Server\n`));
  console.log(chalk.yellow(asciiArt));

  // Live Server Parameters
  const liveServerParams = {
    port: options.port,
    host: options.host,
    root: webroot,
    open: openBrowser,
    ignore: ignore,
    wait: 2000,
    mount: [
      ['/assets', './compiled/assets'],
      ['/images', './demo/images'],
    ],
    logLevel: 2,
    headers: {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
    middleware: [],
    watch: watchDirectories,
  };

  try {
    liveServer.start(liveServerParams);
  } catch (error) {
    console.error(chalk.red("Error starting server:"), error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.red('\nShutting down server...'));
    process.exit();
  });
};
