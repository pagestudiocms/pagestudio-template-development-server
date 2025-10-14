#!/usr/bin/env node

/*!
 *
 * PageStudio Template Development Server 
 * 
 */

"use strict";

const chalk = require('chalk');
const figlet = require('figlet');
const liveServer = require("live-server");
const fs = require('fs'); // Added fs to check if 'compiled' exists
const path = require("path"); 
const args = require('command-line-args');

// Retrieve version from package.json
const packageJsonPath = path.join(__dirname, 'package.json');
let packageVersion = 'unknown';

if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageVersion = packageJson.version || 'unknown';
  } catch (error) {
    console.error(chalk.red('Error reading package.json:'), error);
  }
}

// Setup defaults and options

const meta = {
  VERSION: packageVersion,
  PUBLISHER: 'PageStudioCMS',
  YEAR: '2025',
}

const currentDir = __dirname;
const abspath = path.join(__dirname, './');
const binpath = path.join(abspath, 'bin/');
const libpath = path.join(abspath, 'lib/');

const optionDefinitions = [
  { name: 'watch', alias: 'w', type: String, defaultValue: 'compiled,example/html' },
  { name: 'host', alias: 'h', type: String, defaultValue: '127.0.0.1' },
  { name: 'root', alias: 'r', type: String, defaultValue: 'compiled' },
  { name: 'port', alias: 'p', type: String, defaultValue: '8080' },
  { name: 'open', alias: 'o', type: String, defaultValue: 'true' },
  { name: 'help', alias: '?', type: Boolean, defaultValue: false },       // <-- added
  { name: 'version', alias: 'V', type: Boolean, defaultValue: false }
];
const options = args(optionDefinitions);

const webroot = path.resolve(process.cwd(), options.root);
const watchDirectories = options.watch.split(',').map(dir => dir.trim()); // Convert the watch string into an array if it's provided
const openBrowser = options.open.toLowerCase() === 'true';
const ignore = 'app,bin,build,etc,example,lib,node_modules,src,var';

// Add help / version handling
const printHelp = () => {
  console.log(chalk.green('\nPageStudio Template Development Server — Usage\n'));
  console.log(`  node server.js [options]\n`);
  console.log(chalk.yellow('Options:'));
  console.log(`  -w, --watch     Comma-separated folders to watch   (default: "compiled,example/html")`);
  console.log(`  -r, --root      Root folder to serve              (default: "compiled")`);
  console.log(`  -h, --host      Host to bind to                   (default: "127.0.0.1")`);
  console.log(`  -p, --port      Port to listen on                 (default: "8080")`);
  console.log(`  -o, --open      Open browser on start (true/false) (default: "true")`);
  console.log(`  -V, --version   Print version and exit`);
  console.log(`  -?, --help      Show this help message\n`);
  console.log(chalk.cyan('Examples:'));
  console.log('  node server.js --root compiled --port 3000');
  console.log('  node server.js -w compiled,src -o false\n');
};

if (options.help) {
  printHelp();
  process.exit(0);
}

if (options.version) {
  console.log(`${meta.VERSION}`);
  process.exit(0);
}

// var homeDir = process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'];

// Setup environment

/**
 * Live Server Parameters
 */
const liveServerParams = {
  port: options.port,
  host: options.host,
  root: webroot,            // Set root directory that's being served. Defaults to cwd.
  open: openBrowser,        // When false, it won't load your browser by default.
  ignore: ignore,           // comma-separated string for paths to ignore
  // file: 'default.html',    // When set, serve this file (server root relative) for every 404 (useful for single-page applications)
  wait: 2000,               // Waits for all changes, before reloading. Defaults to 0 sec.
  mount: [
    ['/assets', './compiled/assets'],
    ['/images', './demo/images'],
  ],                        // Mount a directory to a route.
  logLevel: 2,              // 0 = errors only, 1 = some, 2 = lots
  headers: {
    "Cache-Control": "no-cache, no-store, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
  },
  middleware: [],           // An array of Connect-compatible middleware
  watch: watchDirectories,  // Paths to exclusively watch for changes. Defaults to compiled,src/html
};

const preflightChecks = () => {
  // Check if the compiled folder exists
  if (!fs.existsSync(webroot)) {
    throw new Error(`Invalid value for option '--webroot'. The specified path "${webroot}" does not exist.`);
  }
}

// Function to print the ASCII art with styled text
const printStartupMessage = () => {
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
  // console.log(chalk.green(`Server root directory ${currentDir}`));
  // console.log(chalk.green(`Process current working directory ${process.cwd()}`));
};

// Start live server
try {
  printStartupMessage();

  preflightChecks();

  liveServer.start(liveServerParams); // Starting the live server
} catch (error) {
  console.error(chalk.red("Error starting pagestudio-server:"), error);
  process.exit(1); // Exit with error
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.red('\nShutting down server...'));
  process.exit();
});