const fs = require('fs');
const path = require('path');
const { LexParser } = require('../lib/lexParser');

// Create a new parser instance.
const parser = new LexParser();

// Register a plugin callback for the "content:snippet" tag.
// The colon in the template (content:snippet) is mapped to "content_snippet".
parser.registerFunction("content_snippet", (params, context, innerContent, data) => {
  const template = `<div class="snippet">
    <p>Param: ${params.param}</p>
    <p>Content: ${innerContent.trim()}</p>
    <p>Data: ${JSON.stringify(data)}</p>
  </div>`;

  return parser.parse(template, context, data);
});

// Define a sample template string.
const template1 = `
  <h1>{{ site.title }}</h1>
  <h1>{{ title }}</h1>

  <p>Hello, {{ user.name }}!</p>
  
  {{ if user.group == 'admin' }}
    <p>You are an Admin!</p>
  {{ elseif user.group == 'guest' }}
    <p>You are a Guest!</p>
  {{ else }}
    <p>I don't know what you are.</p>
  {{ endif }}
  
  {{ items }}
    <p>Item: {{ name }}</p>
  {{ /items }}
  
  {{ content:snippet param="example" }}
    Hello, {{ user.name }}!
    This is the snippet content.
  {{ /content:snippet }}
`;

const template2 = `
  {{ if user.group == 'admin' }}
    <p>You are an Admin!</p>
  {{ else }}
    <p>I don't know what you are.</p>
  {{ endif }}
`;

// Define context data for variable interpolation.
const context = {
  title: "My Sample Page",
  site: {
    "title": "About | My Website"
  },
  user: { 
    name: "John Doe",
    group: "admin" 
  },
  items: [
    { name: "Item One" },
    { name: "Item Two" }
  ]
};

// Define additional global data to be passed to callbacks.
const data = {
  globalSetting: "some global value"
};

const template3 = fs.readFileSync(path.resolve(process.cwd(), 'tests', 'parseHtmlWithConditionals.test.html'), 'utf-8');

// Parse and render the template.
const parsedContent = parser.parse(template1, context, data);
// const parsedContent = parser.parse(template3, context, data);
console.log(parsedContent.replace(/\n\s*\n/g, '\n\n'));
console.log(parser.resolveVariable('site.title', context));