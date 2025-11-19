#!/usr/bin/env node

/*!
 * PageStudio CLI
 * Main command-line interface router
 */

const { Command } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

// Get package version
const packageJsonPath = path.join(__dirname, '../package.json');
let packageVersion = 'unknown';

if (fs.existsSync(packageJsonPath)) {
  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageVersion = packageJson.version || 'unknown';
  } catch (error) {
    console.error(chalk.red('Error reading package.json:'), error);
  }
}

const program = new Command();

program
  .name('pagestudio')
  .description('PageStudio Template Development Tools')
  .version(packageVersion, '-V, --version', 'Output the current version');

// Server command
program
  .command('server')
  .description('Start development server with live reload')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
  .option('-r, --root <root>', 'Root folder to serve', 'compiled')
  .option('-w, --watch <dirs>', 'Comma-separated directories to watch', 'compiled,example/html')
  .option('-o, --open <bool>', 'Open browser on start', 'true')
  .action((options) => {
    options.version = packageVersion;
    require('../src/commands/server').run(options);
  });

// Compile command
program
  .command('compile')
  .description('Compile templates from source to output directory')
  .option('-s, --src <path>', 'Source directory', 'src')
  .option('-o, --out <path>', 'Output directory', 'compiled')
  .option('-l, --layouts <path>', 'Layouts directory', 'src/html/layouts')
  .option('-p, --partials <path>', 'Partials directory', 'src/html/partials')
  .option('-d, --data-src <path>', 'Data directory', 'src/html/data')
  .option('-a, --assets <path>', 'Assets directory', 'src/assets')
  .option('-c, --config <path>', 'Config file path')
  .option('-w, --watch', 'Watch for file changes')
  .action((options) => {
    require('../src/commands/compile').run(options);
  });

// Dev command - orchestrates everything
program
  .command('dev')
  .description('Start full development environment (assets, compiler, server)')
  .option('--src <path>', 'Source directory', 'src/html')
  .option('--out <path>', 'Output directory', 'compiled')
  .option('--layouts <path>', 'Layouts directory', 'src/html/layouts')
  .option('--partials <path>', 'Partials directory', 'src/html/partials')
  .option('--data-src <path>', 'Data directory', 'src/html/data')
  .option('--assets <path>', 'Assets directory', 'src/assets')
  .option('--port <number>', 'Server port', '3000')
  .option('--open <boolean>', 'Open browser automatically', 'true')
  .option('--config <path>', 'Config file path')
  .action((options) => {
    require('../src/commands/dev').run(options);
  });

// Clean command
program
  .command('clean')
  .description('Remove compiled files and build artifacts')
  .option('-o, --out <path>', 'Output directory to clean', 'compiled')
  .action((options) => {
    require('../src/commands/clean').run(options);
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
