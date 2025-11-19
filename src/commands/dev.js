#!/usr/bin/env node

/*!
 * Dev Command
 * Orchestrates multiple development processes: asset watcher, compiler, and server
 */

const { spawn } = require('child_process');
const path = require('path');
const chalk = require('chalk');
const fs = require('fs');

/**
 * Run the full development environment
 * @param {object} options - Command options
 */
exports.run = (options) => {
  console.log(chalk.blue.bold('🚀 Starting PageStudio Development Server...'));
  console.log('');

  // Keep track of child processes
  const childProcesses = [];

  // Start asset watcher (grunt watch for SCSS/JS) if Gruntfile exists
  let assetWatcher = null;
  const gruntfilePath = path.join(process.cwd(), 'Gruntfile.js');

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
    path.join(__dirname, '../../bin/pagestudio.js'),
    'compile',
    '--src', options.src,
    '--out', options.out,
    '--data-src', options.dataSrc,
    '--partials', options.partials,
    '--layouts', options.layouts,
    '--watch'
  ];

  if (options.config) {
    compilerArgs.push('--config', options.config);
  }

  console.log(chalk.yellow('📦 Starting template compiler...'));
  const compiler = spawn('node', compilerArgs, {
    stdio: ['inherit', 'inherit', 'inherit'],
    shell: true
  });

  childProcesses.push(compiler);

  // Start development server
  const serverArgs = [
    path.join(__dirname, '../../bin/pagestudio.js'),
    'server',
    '--port', options.port.toString(),
    '--open', options.open.toString()
  ];

  console.log(chalk.green(`🌐 Starting development server on port ${options.port}...`));
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
};
