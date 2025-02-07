const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const LexParser = require('../lib/lexParser');
const { file } = require('grunt');
const parser = new LexParser();  // Now create an instance

let callbackData = {};

// Simple callback to replace value with uppercase version 
function exampleCallback(name, parameters, content, data) {
  if (parameters.hasOwnProperty('format') && parameters.format === 'uppercase') {
    // console.log(`name: ${name}`)
    // console.log(`parameters: ${parameters}`)
    // console.log(parameters.hasOwnProperty('format'));
    // console.log(content)
    console.log(data[name])
    content = data[name];
    return content.toUpperCase();
  }
  return content || typeof data[name] !== 'undefined' ? data[name] : '';
}

const srcPath = path.join(__dirname, '../src/');
const layoutPath = path.join(srcPath, `html/layouts/default.html`);
const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
const layoutName = path.basename(layoutPath, '.html');
const dataFilePath = path.join(srcPath, `html/data/${layoutName}.data.json`);

// Load the context for the current layout if available
if (fs.existsSync(dataFilePath)) {
  callbackData = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8')); // Load specific context if the data file exists
} else {
  console.log(`No data found for "${layoutName}". Using default context.`);
}

// parser.scopeGlue('.');
let parsedContent = parser.parse(layoutContent, callbackData, exampleCallback);
// parsedContent = parser.parse(parsedContent, callbackData, exampleCallback);
console.log(parsedContent);
// let result = parser.parseVariables(layoutContent, callbackData, exampleCallback);
// console.log(result);