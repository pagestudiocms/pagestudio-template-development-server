#!/usr/bin/env node

/*!
 * Template Compiler CLI
 */

const fs = require('fs');
const path = require('path');
const commandLineArgs = require('command-line-args');
const { TemplateCompiler } = require('../src/compiler');

// Define CLI argument options — ❌ no defaultValue here
const options = [
  { name: "src", alias: "s", type: String },
  { name: "out", alias: "o", type: String },
  { name: "layouts", alias: "l", type: String },
  { name: "partials", alias: "p", type: String },
  { name: "data-src", alias: "d", type: String },
  { name: "assets", alias: "a", type: String },
  { name: "config", alias: "c", type: String },
  { name: "watch", alias: "w", type: Boolean },
  { name: "help", alias: "h", type: Boolean }
];

// Parse command line arguments
const args = commandLineArgs(options);

// Show help if requested
if (args.help) {
  console.log('PageStudio Template Compiler');
  console.log('');
  console.log('Usage: pagestudio-compile [options]');
  console.log('');
  console.log('Options:');
  console.log('  -s, --src <path>        Source directory');
  console.log('  -o, --out <path>        Output directory');
  console.log('  -l, --layouts <path>    Layouts directory');
  console.log('  -p, --partials <path>   Partials directory');
  console.log('  -d, --data-src <path>   Data directory');
  console.log('  -a, --assets <path>     Assets directory');
  console.log('  -c, --config <path>     Config file path');
  console.log('  -w, --watch             Watch for file changes');
  console.log('  -h, --help              Show this help');
  process.exit(0);
}

// Validate config file path if provided
if (args.config && !fs.existsSync(args.config)) {
  console.error(`Warning: Config file "${args.config}" not found. Default "<project-root>/site.config.json" path will be used if exists.`);
}

// Load config file (if any)
const configPath = path.resolve(args.config || 'site.config.json');
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (error) {
    console.error(`Error parsing config file at ${configPath}:`, error.message);
    process.exit(1);
  }
}

// 🧩 Merge with correct precedence
// CLI args override config; config overrides defaults
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
  src: args.src ?? config.src ?? defaults.src,
  out: args.out ?? config.out ?? defaults.out,
  layouts: args.layouts ?? config.layouts ?? defaults.layouts,
  partials: args.partials ?? config.partials ?? defaults.partials,
  dataSrc: args['data-src'] ?? config['data-src'] ?? defaults.dataSrc,
  assets: args.assets ?? config.assets ?? defaults.assets,
  watch: args.watch ?? config.watch ?? defaults.watch
};

// console.log("Final configuration:", finalConfig);

// Check for required directories
for (const dir of [
    finalConfig.layouts, 
    finalConfig.partials, 
    finalConfig.dataSrc, 
    // finalConfig.assets
  ]
) {
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
if (finalConfig.watch) compiler.watch();
