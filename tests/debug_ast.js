const { LexParser } = require('../src/lib/lexParser');

const parser = new LexParser();

const innerRaw = `\n  {{ if featured }}<div class=\"featured\">{{ title }}</div>{{ else }}<div>{{ title }}</div>{{ /if }}\n`;

console.log('INNER RAW:');
console.log(JSON.stringify(innerRaw));

const tokens = parser.tokenize(innerRaw);
console.log('\nTOKENS:');
console.log(tokens);

const ast = parser.buildAST(tokens, innerRaw);
console.log('\nAST:');
console.log(JSON.stringify(ast, null, 2));

// Also test renderPartial
const out = parser.renderPartial(ast, { featured: true, title: 'X' }, {});
console.log('\nRENDER PARTIAL (featured true):');
console.log(JSON.stringify(out));

const out2 = parser.renderPartial(ast, { featured: false, title: 'Y' }, {});
console.log('\nRENDER PARTIAL (featured false):');
console.log(JSON.stringify(out2));
