#!/usr/bin/env node

/*!
 * 
 * Template Compiler CLI
 * This is the command line interface for the template compiler
 * 
 */

const path = require('path');
const commandLineArgs = require('command-line-args');
const { TemplateCompiler } = require('../src/compiler');

// Define CLI argument options
const options = [
  { name: "src", alias: "s", type: String, defaultValue: "src" },
  { name: "dest", alias: "d", type: String, defaultValue: "compiled" },
  { name: "partials", alias: "p", type: String, defaultValue: "src/partials" },
  { name: "data-src", alias: "a", type: String, defaultValue: "src/html/data" }, 
  { name: "watch", alias: "w", type: Boolean, defaultValue: true }
];

// Parse command line arguments
const args = commandLineArgs(options);

// Initialize and run the template compiler with CLI arguments
const compiler = new TemplateCompiler({
  src: args.src,
  dest: args.dest,
  partials: args.partials,
  'data-src': args['data-src']
});

// Start compilation process
compiler.compile();

// Start file watching if enabled
if (args.watch) {
  compiler.watch();
}
