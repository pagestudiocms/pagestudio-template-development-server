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

program
  .command('proxy-server')
  .description('Start development server with live reload')
  .option('-p, --port <port>', 'Port to listen on', '8080')
  .option('-h, --host <host>', 'Host to bind to', '127.0.0.1')
  .option('-r, --root <root>', 'Root folder to serve', 'compiled')
  .option('-w, --watch <dirs>', 'Comma-separated directories to watch', 'compiled,example/html')
  .option('-o, --open <bool>', 'Open browser on start', 'true')
  .action((options) => {
    options.version = packageVersion;
    require('../src/commands/proxy-server').run(options);
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
    return require('../src/commands/compile').run(options);
  });

// Dev command - orchestrates everything
program
  .command('dev')
  .description('Start full development environment (assets, compiler, server)')
  .option('--src <path>', 'Source directory (default: src/html)')
  .option('--out <path>', 'Output directory (default: compiled)')
  .option('--layouts <path>', 'Layouts directory')
  .option('--partials <path>', 'Partials directory')
  .option('--data-src <path>', 'Data directory')
  .option('--assets <path>', 'Assets directory', 'src/assets')
  .option('--port <number>', 'Server port (default: 3000)')
  .option('--open <boolean>', 'Open browser automatically (default: true)')
  .option('--host <host>', 'Preview host (default: 127.0.0.1)')
  .option('--asset-script <name>', 'Existing one-shot npm asset script, or none')
  .option('--asset-watch <paths>', 'Comma-separated literal asset input paths')
  .option('--debounce <ms>', 'Quiet window for rebuilds (default: 100)')
  .option('--config <path>', 'Config file path')
  .action((options) => {
    return require('../src/commands/dev').run(options);
  });

// Clean command
program
  .command('clean')
  .description('Remove compiled files and build artifacts')
  .option('-o, --out <path>', 'Output directory to clean', 'compiled')
  .action((options) => {
    require('../src/commands/clean').run(options);
  });

// Contract bundle management (local CMS export source).
program.command('init')
  .description('Merge reusable PageStudio guidance and project-local Codex MCP configuration')
  .requiredOption('--agent <agent>', 'Agent client (codex)')
  .option('--project-root <directory>', 'Target project (otherwise detect nearest package.json/.git from cwd)')
  .option('--dry-run', 'Preview complete changes without writing files')
  .action(options => require('../src/commands/init').run(options));

program.command('doctor')
  .description('Diagnose local Codex, contracts, read-only MCP protocol and dev-owner readiness')
  .option('--project-root <directory>', 'Target project (otherwise detect nearest package.json/.git from cwd)')
  .option('--config <path>', 'Existing dev configuration to inspect (default: site.config.json)')
  .option('--json', 'Print a structured diagnostic report')
  .action(options => require('../src/commands/doctor').run(options));

const contracts = program.command('contracts').description('Manage project-local CMS block contracts');
contracts.command('sync')
  .description('Copy and validate an exported CMS contract bundle into .pagestudio/contracts')
  .requiredOption('--from <directory>', 'Directory containing the CMS contract export')
  .option('--project-root <directory>', 'Template project root (defaults to PAGESTUDIO_PROJECT_ROOT or cwd)')
  .action((options) => {
    try {
      const result = require('../src/commands/contracts').syncContracts({
        source: options.from,
        projectRoot: options.projectRoot || process.env.PAGESTUDIO_PROJECT_ROOT || process.cwd()
      });
      console.log(`Synced ${result.blocks} CMS block contracts to ${result.destination}`);
    } catch (error) {
      console.error(chalk.red('Contract sync failed:'), error.message);
      process.exitCode = 1;
    }
  });

// Parse command line arguments
program.parseAsync(process.argv).catch(error => {
  console.error(chalk.red(error.message));
  process.exitCode = 1;
});

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
