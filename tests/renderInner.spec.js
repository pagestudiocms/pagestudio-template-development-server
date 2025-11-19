const { expect } = require('chai');
const { LexParser } = require('../src/lib/lexParser');
const contentEntries = require('../src/plugins/content_entries');

describe('renderInner helper', () => {
  it('evaluates conditionals and preserves variables per item', () => {
    const parser = new LexParser();

    parser.registerFunction('content_entries', (params, context, innerRaw, innerParsed, data, helpers) => {
      return contentEntries(params, context, innerRaw, innerParsed, data, helpers);
    });

    const tpl = `{{ content:entries }}\n  {{ if featured }}<div class=\"featured\">{{ title }}</div>{{ else }}<div>{{ title }}</div>{{ /if }}\n{{ /content:entries }}`;

    const context = {
      entries: [
        { featured: true, title: 'First' },
        { featured: false, title: 'Second' }
      ]
    };

    const result = parser.parse(tpl, context, {});

    // Should contain conditional-driven markup and resolved titles
    expect(result).to.include('<div class="featured">First</div>');
    expect(result).to.include('<div>Second</div>');
  });
});
