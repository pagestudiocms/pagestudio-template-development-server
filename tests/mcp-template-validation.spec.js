'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { validateTemplate } = require('../src/mcp/template-validation');

describe('MCP template validation', function () {
  let root;
  beforeEach(function () { root = fs.mkdtempSync(path.join(os.tmpdir(), 'pagestudio-template-')); });
  afterEach(function () { fs.rmSync(root, { recursive: true, force: true }); });
  it('accepts a readable HTML file without claiming CMS compatibility', function () {
    fs.writeFileSync(path.join(root, 'index.html'), '<main>Test</main>');
    const result = validateTemplate('index.html', root);
    assert.equal(result.valid, true);
    assert.deepEqual(result.findings, []);
    assert.match(result.limitations.join(' '), /not validated/);
  });
  it('reports a missing file', function () {
    const result = validateTemplate('missing.html', root);
    assert.equal(result.valid, false);
    assert.equal(result.findings[0].ruleId, 'PS-TPL-001');
  });
  it('warns on an empty file', function () {
    fs.writeFileSync(path.join(root, 'empty.html'), ' ');
    const result = validateTemplate('empty.html', root);
    assert.equal(result.valid, true);
    assert.equal(result.findings[0].severity, 'warning');
  });
  it('rejects unsupported extensions', function () {
    fs.writeFileSync(path.join(root, 'style.css'), 'body{}');
    assert.equal(validateTemplate('style.css', root).valid, false);
  });
  it('rejects traversal and absolute paths', function () {
    assert.throws(() => validateTemplate('../secret.html', root), /relative path/);
    assert.throws(() => validateTemplate(path.join(root, 'index.html'), root), /relative path/);
  });
  it('rejects symlinks escaping the project root', function () {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'pagestudio-outside-'));
    try {
      fs.writeFileSync(path.join(outside, 'secret.html'), 'secret');
      fs.symlinkSync(path.join(outside, 'secret.html'), path.join(root, 'link.html'));
      const result = validateTemplate('link.html', root);
      assert.equal(result.valid, false);
      assert.equal(result.findings[0].ruleId, 'PS-TPL-004');
    } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  });
});
