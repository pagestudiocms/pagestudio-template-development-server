#!/usr/bin/env node

/*!
 * Compile Command
 * Compiles templates from source to output directory
 */

const fs = require('fs');
const path = require('path');
const { TemplateCompiler } = require('../compiler');

/**
 * Run the template compiler
 * @param {object} options - Command options
 */
exports.run = (options) => {
  // Validate config file path if provided
  if (options.config && !fs.existsSync(options.config)) {
    console.error(`Warning: Config file "${options.config}" not found. Default "<project-root>/site.config.json" path will be used if exists.`);
  }

  // Load config file (if any)
  const configPath = path.resolve(options.config || 'site.config.json');
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch (error) {
      console.error(`Error parsing config file at ${configPath}:`, error.message);
      process.exit(1);
    }
  }

  // Merge with correct precedence: CLI args > config > defaults
  const defaults = {
    src: "src",
    out: "compiled",
    layouts: "src/html/layouts",
    partials: "src/html/partials",
    dataSrc: "src/html/data",
    assets: "src/assets",
    watch: false
  };

  const finalConfig = {
    src: options.src ?? config.src ?? defaults.src,
    out: options.out ?? config.out ?? defaults.out,
    layouts: options.layouts ?? config.layouts ?? defaults.layouts,
    partials: options.partials ?? config.partials ?? defaults.partials,
    dataSrc: options.dataSrc ?? config['data-src'] ?? defaults.dataSrc,
    assets: options.assets ?? config.assets ?? defaults.assets,
    watch: options.watch ?? config.watch ?? defaults.watch
  };

  // Check for required directories
  for (const dir of [
    finalConfig.layouts,
    finalConfig.partials,
    finalConfig.dataSrc,
  ]) {
    if (!fs.existsSync(dir)) {
      console.error(`Required directory does not exist: ${dir}`);
      process.exit(1);
    }
  }

  // Initialize compiler
  const compiler = new TemplateCompiler(finalConfig);

  // Run compilation
  compiler.compile();

  // Watch mode
  if (finalConfig.watch) {
    compiler.watch();
  }
};
