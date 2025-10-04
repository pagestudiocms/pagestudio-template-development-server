const { LexParser } = require('../lib/lexParser');
const path = require('path');

// Load plugin
const contentEntries = require('../src/plugins/content_entries');

function runTest() {
  const parser = new LexParser();

  // Register plugin as it would be registered in the real system
  parser.registerFunction('content_entries', (params, context, innerRaw, innerParsed, data, helpers) => {
    // Delegate to the plugin module to mimic real environment
    return contentEntries(params, context, innerRaw, innerParsed, data, helpers);
  });

  // Template simulating a block callback with conditionals and a variable placeholder.
  const tpl = `{{ content:entries }}\n  {{ if featured }}<div class=\"featured\">{{ title }}</div>{{ else }}<div>{{ title }}</div>{{ /if }}\n{{ /content:entries }}`;

  // Prepare context with entries array containing two items
  const context = {
    entries: [
      { featured: true, title: 'First' },
      { featured: false, title: 'Second' }
    ]
  };

  const result = parser.parse(tpl, context, {});

  console.log('--- Rendered Output ---');
  console.log(JSON.stringify(result));

  // Basic assertions (not using a test runner):
  // After final variable-resolution pass, titles should be resolved to actual values
  const hasFirstFeatured = result.includes('<div class="featured">First</div>');
  const hasSecondNormal = result.includes('<div>Second</div>');

  console.log('First item featured?:', hasFirstFeatured);
  console.log('Second item normal?:', hasSecondNormal);

  if (hasFirstFeatured && hasSecondNormal) {
    console.log('TEST OK: renderInner evaluated conditionals and final resolution produced expected titles');
    process.exit(0);
  } else {
    console.error('TEST FAIL');
    process.exit(2);
  }
}

runTest();
