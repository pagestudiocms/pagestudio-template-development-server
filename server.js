#!/usr/bin/env node

/*!
 *
 * PageStudio Template Development Server 
 * 
 */

"use strict";

// Setup paths 

const path = require("path"); 
const abspath = path.join(__dirname, '../');
const binpath = path.join(abspath, 'bin/');
const libpath = path.join(abspath, 'lib/');

// Application dependencies 

const chalk = require('chalk');
const figlet = require('figlet');
const clear = require('clear');
const http = require('http');
const express = require('express');
const liveServer = require("live-server");
// const middleware = require(path.join(libpath, 'middleware')); 

// Setup defaults 

var ignore = 'app,bin,etc,lib,node_modules,src,var';

var defaults = {
  port: 9000,               // Set the server port. Defaults to 8080.
  host: "127.0.0.1",        // Set the address to bind to. Defaults to 0.0.0.0 or process.env.IP.
  root: "./demo",           // Set root directory that's being served. Defaults to cwd.
  open: false,              // When false, it won't load your browser by default.
  ignore: ignore,           // comma-separated string for paths to ignore
  // file: '/app/404.html',    // When set, serve this file (server root relative) for every 404 (useful for single-page applications)
  wait: 2000,               // Waits for all changes, before reloading. Defaults to 0 sec.
  mount: [
    ['/components', './node_modules'],
    ['/cache', './var/cache'],
    ['/assets', './build/assets'],
    ['/build/assets', './build/assets'],
    ['/demo/assets', './demo/assets'],
    ['/src', './src']
  ],                        // Mount a directory to a route.
  logLevel: 2,              // 0 = errors only, 1 = some, 2 = lots
  middleware: [
    // middleware
  ] // Takes an array of Connect-compatible middleware that are injected into the server middleware stack
};

// clear();

console.log(
  chalk.yellow(
    figlet.textSync('PageStudio', { horizontalLayout: 'full' })
  )
);

liveServer.start(defaults); // Starting the live server

console.log(
  chalk.green(`Server listening on ${defaults.port}`)
);