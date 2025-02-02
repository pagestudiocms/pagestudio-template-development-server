#!/usr/bin/env node

/*!
 *
 * PageStudio Template Development Server 
 * 
 */

"use strict";

// Setup environment

const chalk = require('chalk');
const figlet = require('figlet');
const liveServer = require("live-server");
const fs = require('fs'); // Added fs to check if 'dist' exists
const path = require("path"); 

// Setup paths 

const currentDir = __dirname;
const templateProjectRoot = path.resolve(currentDir, '../pagestudiocms-templates/frontsite-template');

const abspath = path.join(__dirname, './');
const binpath = path.join(abspath, 'bin/');
const libpath = path.join(abspath, 'lib/');
// const webroot = path.join(templateProjectRoot, 'dist/'); // dist folder in your test project
const webroot = path.join(abspath, 'dist/');

console.log('Project Directory:', currentDir);
console.log('Template Directory:', webroot);

// Setup defaults 

const ignore = 'app,bin,build,etc,lib,node_modules,src,var';

const defaults = {
  port: process.env.PORT || 8080,         // Set the server port. Defaults to 8080.
  host: process.env.HOST || "127.0.0.1",  // Set the address to bind to. Defaults to 0.0.0.0 or process.env.IP.
  root: webroot,           // Set root directory that's being served. Defaults to cwd.
  open: true,              // When false, it won't load your browser by default.
  ignore: ignore,           // comma-separated string for paths to ignore
  // file: 'default.html',    // When set, serve this file (server root relative) for every 404 (useful for single-page applications)
  wait: 2000,               // Waits for all changes, before reloading. Defaults to 0 sec.
  mount: [
    ['/assets', './dist/assets'],
  ],                        // Mount a directory to a route.
  logLevel: 2,              // 0 = errors only, 1 = some, 2 = lots
  headers: {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  },
  middleware: [], // An array of Connect-compatible middleware
  watch: [
    'dist', 
    'src/html'
  ]
};

// Start live server
try {
  liveServer.start(defaults); // Starting the live server
  console.log(
    chalk.yellow(
      figlet.textSync('PageStudio', { horizontalLayout: 'full' })
    )
  );
  console.log(chalk.green(`Server listening on http://${defaults.host}:${defaults.port}`));
} catch (error) {
  console.error(chalk.red('Error starting live-server:'), error);
  // process.exit(1); // Exit with error
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.red('\nShutting down server...'));
  process.exit();
});