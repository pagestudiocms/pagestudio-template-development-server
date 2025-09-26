const assert = require('assert');
const { LexParser } = require('../lib/lexParser');
const { TestRunner } = require('../lib/testRunner');

// --- Tests ---
const parser = new LexParser();

// Register a simple callback to mimic plugin behavior
parser.registerFunction('content_snippet', (params, context, innerContent, data) => {
  if (params.format === 'uppercase' && params.name && data && data[params.name]) {
    return data[params.name].toUpperCase();
  }
  return innerContent || '';
});

function testVariableInterpolation() {
  const tpl = 'Hello, {{ user.name }}!';
  const out = parser.parse(tpl, { user: { name: 'Alice' } });
  assert.strictEqual(out, 'Hello, Alice!');
}

function testLoopingArray() {
  const tpl = '{{ items }}<li>{{ name }}</li>{{ /items }}';
  const data = { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] };
  const out = parser.parse(tpl, data);
  assert.strictEqual(out, '<li>a</li><li>b</li><li>c</li>');
}

function testLoopingObject() {
  const tpl = '{{ people }}<p>{{ real_name.first }} {{ real_name.last }}</p>{{ /people }}';
  const data = { people: { p1: { real_name: { first: 'John', last: 'Doe' } } } };
  const out = parser.parse(tpl, data);
  assert.strictEqual(out, '<p>John Doe</p>');
}

function testConditionals() {
  const tpl = `{{ if user.exists }}Yes{{ else }}No{{ endif }}`;
  const out1 = parser.parse(tpl, { user: { exists: true } });
  const out2 = parser.parse(tpl, { user: { exists: false } });
  assert.strictEqual(out1.trim(), 'Yes');
  assert.strictEqual(out2.trim(), 'No');
}

function testUnless() {
  const tpl = `{{ unless user.admin }}Not Admin{{ else }}Is Admin{{ endif }}`;
  const out1 = parser.parse(tpl, { user: { admin: false } });
  const out2 = parser.parse(tpl, { user: { admin: true } });
  assert.strictEqual(out1.trim(), 'Not Admin');
  assert.strictEqual(out2.trim(), 'Is Admin');
}

function testCallbackPlugin() {
  const tpl = `{{ content:snippet name="title" format="uppercase" }}Default{{ /content:snippet }}`;
  const data = { title: 'hello' };
  const out = parser.parse(tpl, '', data);
  assert.strictEqual(out, 'HELLO');
}

function testExpressionEvaluation() {
  const tpl = `{{ if page.slug == 'templates' }}Matches{{ else }}No{{ endif }}`;
  const out = parser.parse(tpl, { page: { slug: 'templates' } });
  assert.strictEqual(out.trim(), 'Matches');
}

// Register tests with the runner
const runner = new TestRunner();
runner.add('testVariableInterpolation', testVariableInterpolation);
runner.add('testLoopingArray', testLoopingArray);
runner.add('testLoopingObject', testLoopingObject);
runner.add('testConditionals', testConditionals);
runner.add('testUnless', testUnless);
runner.add('testCallbackPlugin', testCallbackPlugin);
runner.add('testExpressionEvaluation', testExpressionEvaluation);

// Execute
runner.run();
