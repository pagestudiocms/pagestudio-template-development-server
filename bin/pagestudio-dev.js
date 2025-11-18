#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const commandLineArgs = require('command-line-args');
const chalk = require('chalk');

const options = [
  { name: 'src', type: String, defaultValue: 'src/html' },
  { name: 'out', type: String, defaultValue: 'compiled' },
  { name: 'layouts', type: String, defaultValue: 'src/html/layouts' },
  { name: 'partials', type: String, defaultValue: 'src/html/partials' },
  { name: 'data-src', type: String, defaultValue: 'src/html/data' },
  { name: 'assets', type: String, defaultValue: 'src/assets' },
  { name: 'port', type: Number, defaultValue: 3000 },
  { name: 'open', type: Boolean, defaultValue: true },
  { name: 'config', type: String },
  { name: 'help', alias: 'h', type: Boolean }
];

const args = commandLineArgs(options);

if (args.help) {
  console.log(chalk.blue.bold('PageStudio Development Server'));
  console.log('');
  console.log('Usage: pagestudio-dev [options]');
  console.log('');
  console.log('Options:');
  console.log('  --src <path>        Source directory (default: src/html)');
  console.log('  --out <path>        Output directory (default: compiled)');
  console.log('  --layouts <path>    Layouts directory (default: src/html/layouts)');
  console.log('  --partials <path>   Partials directory (default: src/html/partials)');
  console.log('  --data-src <path>   Data directory (default: src/html/data)');
  console.log('  --assets <path>     Assets directory (default: src/assets)');
  console.log('  --port <number>     Server port (default: 3000)');
  console.log('  --open <boolean>    Open browser automatically (default: true)');
  console.log('  --config <path>     Config file path');
  console.log('  --help, -h          Show this help');
  process.exit(0);
}

console.log(chalk.blue.bold('🚀 Starting PageStudio Development Server...'));
console.log('');

// Keep track of child processes
const childProcesses = [];

// Start asset watcher (grunt watch for SCSS/JS) if Gruntfile exists
let assetWatcher = null;
const gruntfilePath = path.join(process.cwd(), 'Gruntfile.js');
const fs = require('fs');

if (fs.existsSync(gruntfilePath)) {
  console.log(chalk.magenta('🎨 Starting asset watcher (SCSS/JS)...'));
  assetWatcher = spawn('npx', ['grunt', 'watch'], {
    stdio: ['inherit', 'inherit', 'inherit'],
    shell: true,
    cwd: process.cwd()
  });
  
  childProcesses.push(assetWatcher);
  
  assetWatcher.on('error', (error) => {
    console.error(chalk.red('❌ Asset watcher error:'), error);
  });

  assetWatcher.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM') {
      console.error(chalk.red(`❌ Asset watcher exited with code ${code}`));
    }
  });
}

// Start template compiler with watch mode
const compilerArgs = [
  '--trace-warnings',
  path.join(__dirname, 'template-compiler.js'),
  '--src', args.src,
  '--out', args.out,
  '--data-src', args['data-src'],
  '--partials', args.partials,
  '--layouts', args.layouts,
  '--watch'
];

if (args.config) {
  compilerArgs.push('--config', args.config);
}

console.log(chalk.yellow('📦 Starting template compiler...'));
const compiler = spawn('node', compilerArgs, {
  stdio: ['inherit', 'inherit', 'inherit'],
  shell: true
});

childProcesses.push(compiler);

// Start development server
const serverArgs = [
  path.join(__dirname, '../server.js'),
  '--port', args.port.toString(),
  '--open', args.open.toString()
];

console.log(chalk.green(`🌐 Starting development server on port ${args.port}...`));
const server = spawn('node', serverArgs, {
  stdio: ['inherit', 'inherit', 'inherit'],
  shell: true
});

childProcesses.push(server);

// Handle cleanup
const cleanup = () => {
  console.log('');
  console.log(chalk.red('Shutting down PageStudio Development Server...'));
  
  childProcesses.forEach(process => {
    if (process && !process.killed) {
      process.kill('SIGTERM');
    }
  });
  
  // Force exit after 3 seconds
  setTimeout(() => {
    process.exit(0);
  }, 3000);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

compiler.on('error', (error) => {
  console.error(chalk.red('❌ Template compiler error:'), error);
});

server.on('error', (error) => {
  console.error(chalk.red('❌ Server error:'), error);
});

compiler.on('exit', (code, signal) => {
  if (code !== 0 && signal !== 'SIGTERM') {
    console.error(chalk.red(`❌ Template compiler exited with code ${code}`));
  }
});

server.on('exit', (code, signal) => {
  if (code !== 0 && signal !== 'SIGTERM') {
    console.error(chalk.red(`❌ Server exited with code ${code}`));
  }
});

console.log('');
console.log(chalk.green('✨ Development environment is starting up...'));
if (assetWatcher) {
  console.log(chalk.gray('• Asset watcher (SCSS/JS) - watching src/scss and src/js'));
}
console.log(chalk.gray('• Template compiler - watching HTML templates, layouts, and partials'));
console.log(chalk.gray('• Development server - serving compiled files with live reload'));
console.log(chalk.gray('Press Ctrl+C to stop all processes'));