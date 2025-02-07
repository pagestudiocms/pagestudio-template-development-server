const fs = require('fs');
const path = require('path');

const { LexParser, ParseConditionals } = require('../lib/lexParser'); // Adjust the path as needed

// Example Usage
const data = {
  user: 'John',
  site: {
    title: "templates"
  }
};

const template = fs.readFileSync(path.resolve(process.cwd(), 'tests', 'parseHtmlWithConditionals.test.html'), 'utf-8');
const parsedContent = new ParseConditionals(template, data);
console.log(parsedContent.render().replace(/\n\s*\n/g, '\n'));
