'use strict';
const assert = require('node:assert/strict');
const { analyzeTemplateSyntax } = require('../src/mcp/template-syntax');
const { Parser } = require('../src/compiler/parser');

describe('Verified CMS Lex syntax profile', function () {
  const check = source => analyzeTemplateSyntax(source, 'layout.html');
  it('PS-SYN-001 reports precise delimiter, comment and noparse failures', function () {
    for (const source of ['{{# comment', '{{ noparse }}literal', '{{ /noparse }}', '{{ if active']) {
      const result = check('hello\n  ' + source);
      assert.equal(result.findings[0].ruleId, 'PS-SYN-001');
      assert.equal(result.findings[0].line, 2); assert.equal(result.findings[0].column, 3);
      assert.ok(result.findings[0].recommendation);
    }
  });
  it('PS-SYN-001 accepts comments and opaque noparse blocks, including their conditional-looking contents', function () {
    assert.deepEqual(check('{{# {{ else }} #}}{{ noparse }}{{# {{ if broken {{ else }}{{ /noparse }}').findings, []);
  });
  it('PS-SYN-002 reports missing/orphan closers, empty conditions, invalid branch order and duplicate else', function () {
    for (const source of ['{{ if active }}', '{{ endif }}', '{{ /if }}', '{{ else }}', '{{ elseif active }}',
      '{{ if }}{{ endif }}', '{{ if active }}{{ else }}{{ else }}{{ endif }}',
      '{{ if active }}{{ else }}{{ elseif next }}{{ endif }}']) {
      assert.ok(check(source).findings.some(finding => finding.ruleId === 'PS-SYN-002'), source);
    }
  });
  it('PS-SYN-002 accepts nested conditions, elseif and both verified closing styles', function () {
    const source = '{{ if active }}{{ if child }}yes{{ /if }}{{ elseif other }}other{{ else }}no{{ endif }}';
    assert.deepEqual(check(source).findings, []);
  });
  it('leaves data-dependent variables, callbacks and undocumented constructs unchecked', function () {
    const source = '{{ title }}{{ users }}{{ user:name format="uppercase" }}{{ /users }}{{ *recursive children* }}{{ unless active }}x{{ /unless }}';
    const result = check(source);
    assert.deepEqual(result.findings, []);
    assert.match(result.limitations.join(' '), /Undocumented CMS conditional/);
    assert.deepEqual(check('literal {{ unknown').findings, []);
  });
  it('keeps development HTML compilation behavior unchanged', function () {
    const source = '<h1>{{ title }}</h1>{{ if active }}<p>Shown</p>{{ /if }}';
    const parser = new Parser();
    const before = parser.processTemplate(source, { title: 'Hello', active: true }, {});
    check(source);
    assert.equal(parser.processTemplate(source, { title: 'Hello', active: true }, {}), before);
    assert.equal(before, '<h1>Hello</h1><p>Shown</p>');
  });
});
