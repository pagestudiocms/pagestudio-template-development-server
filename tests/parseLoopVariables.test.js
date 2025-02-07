const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const LexParser = require('../lib/lexParser');
const { file } = require('grunt');
const parser = new LexParser();  // Now create an instance

// Input text with recursive structures
const text = "{{ users }}<p>{{ name }}</p>{{ /users }}";

// Example callback data
let callbackData = {
  users: [
    { name: "Alice", users: [{ name: "Bob" }, { name: "Charlie" }] },
    { name: "Dave", users: [{ name: "Eve" }, { name: "Frank" }] },
  ],
};

// Simple callback to replace {{ name }} within origText with actual context value
function exampleCallback(name, parameters, content) {
  // console.log(name)
  // console.log(parameters)
  // console.log(content)
  if (parameters.format === 'uppercase') {
    return content.toUpperCase();
  }
  return content || data[name] || '';
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

const result = parser.parseVariables(layoutContent, callbackData, exampleCallback);
console.log(result);