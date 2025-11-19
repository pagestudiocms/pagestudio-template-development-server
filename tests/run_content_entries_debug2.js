const fs = require('fs');
const {LexParser} = require('../src/lib/lexParser');
const contentEntries = require('../src/plugins/content_entries');

const parser = new LexParser();
const innerRaw = fs.readFileSync('example/html/layouts/default.html','utf8');
// extract the innerRaw for content:entries by tokenizing and finding the callback node
const tokens = parser.tokenize(innerRaw);
const ast = parser.buildAST(tokens, innerRaw);
const cb = ast.children.find(n => n.type === 'callback');
console.log('Found callback node:', !!cb);
const inner = cb && cb.raw;
console.log('INNER RAW SLICE:', JSON.stringify(inner));

const data = JSON.parse(fs.readFileSync('example/html/data/default.data.json','utf8'));
const context = data;

const helpers = {
  renderInner: (localScope) => {
    const tokens = parser.tokenize(inner);
    const ast = parser.buildAST(tokens, inner);
    return parser.renderPartial(ast, localScope, {});
  },
  resolveVariables: (s, ctx) => parser.resolveVariablesInString(s, ctx)
};

const out = contentEntries({}, context, inner, '', {}, helpers);
console.log('\nPLUGIN OUTPUT:\n', out);
