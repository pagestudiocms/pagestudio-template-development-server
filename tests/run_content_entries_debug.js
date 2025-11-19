const {LexParser} = require('../src/lib/lexParser');
const contentEntries = require('../src/plugins/content_entries');

const parser = new LexParser();
const innerRaw = `
        <div class="entry">
            <h3>{{ if url=="home" }}<i class="home-page"></i>{{ endif }} - {{ title }}</h3>
            <p>{{ body }}</p>
            <a href="{{ url }}">Read more</a> 
        </div>
    `;
const context = { entries: [ { title: 'First Entry', body: 'Body one', url: 'home' }, { title: 'Second Entry', body: 'Body two', url: 'post2' } ] };
const helpers = {
  renderInner: (localScope) => {
    const tokens = parser.tokenize(innerRaw);
    const ast = parser.buildAST(tokens, innerRaw);
    return parser.renderPartial(ast, localScope, {});
  },
  resolveVariables: (s, ctx) => parser.resolveVariablesInString(s, ctx)
};

const out = contentEntries({}, context, innerRaw, '', {}, helpers);
console.log('OUT:');
console.log(out);
