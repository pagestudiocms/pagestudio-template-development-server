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
  it('uses PAGESTUDIO_PROJECT_ROOT when an explicit root is not provided', function () {
    fs.writeFileSync(path.join(root, 'index.html'), '<main>Project</main>');
    const previous = process.env.PAGESTUDIO_PROJECT_ROOT;
    try {
      process.env.PAGESTUDIO_PROJECT_ROOT = root;
      const result = validateTemplate('index.html');
      assert.equal(result.valid, true);
      assert.deepEqual(result.findings, []);
    } finally {
      if (previous === undefined) delete process.env.PAGESTUDIO_PROJECT_ROOT;
      else process.env.PAGESTUDIO_PROJECT_ROOT = previous;
    }
  });
  it('lets an explicit root override PAGESTUDIO_PROJECT_ROOT', function () {
    fs.writeFileSync(path.join(root, 'index.html'), '<main>Project</main>');
    const previous = process.env.PAGESTUDIO_PROJECT_ROOT;
    try {
      process.env.PAGESTUDIO_PROJECT_ROOT = path.join(root, 'not-a-project');
      assert.equal(validateTemplate('index.html', root).valid, true);
    } finally {
      if (previous === undefined) delete process.env.PAGESTUDIO_PROJECT_ROOT;
      else process.env.PAGESTUDIO_PROJECT_ROOT = previous;
    }
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
  it('preserves file size and regular-file checks with actionable diagnostics', function () {
    fs.mkdirSync(path.join(root, 'directory.html'));
    fs.writeFileSync(path.join(root, 'huge.html'), 'x'.repeat(1024 * 1024 + 1));
    for (const [file, rule] of [['directory.html', 'PS-TPL-004'], ['huge.html', 'PS-TPL-005']]) {
      const result = validateTemplate(file, root);
      assert.equal(result.findings[0].ruleId, rule);
      assert.equal(result.findings[0].line, null); assert.equal(result.findings[0].selector, null);
      assert.ok(result.findings[0].recommendation); assert.ok(result.findings[0].evidence);
    }
  });
  it('integrates real fixtures, all analysis phases and uniform diagnostic fields', function () {
    fs.mkdirSync(path.join(root, '.pagestudio'));
    fs.cpSync(path.join(__dirname, 'fixtures/cms-contracts'), path.join(root, '.pagestudio/contracts'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '\n{{ else }}');
    fs.writeFileSync(path.join(root, 'site.css'), 'h1 { text-align:center !important; all:unset }\n@media (max-width:600px) {h1 {display:none;min-width:900px}}\n@media (min-width:600px) {h1 {display:block}}\n.absent {color:red}');
    const previous = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    try {
      delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
      const result = validateTemplate('index.html', root);
      assert.equal(result.valid, false);
      assert.deepEqual(new Set(result.findings.map(item => item.ruleId)), new Set(['PS-SYN-002', 'PS-CSS-102', 'PS-CSS-103', 'PS-CSS-101', 'PS-RESP-001', 'PS-RESP-002']));
      for (const item of result.findings) assert.deepEqual(Object.keys(item), ['ruleId', 'severity', 'file', 'line', 'column', 'selector', 'construct', 'block', 'message', 'evidence', 'explanation', 'recommendation']);
      assert.equal(result.analysis.selectors.at(-1).status, 'unmatched');
      fs.writeFileSync(path.join(root, 'index.html'), '<main>Valid source</main>');
      const warnings = validateTemplate('index.html', root);
      assert.equal(warnings.valid, true);
      assert.ok(warnings.findings.some(item => item.severity === 'warning'));
      assert.ok(warnings.findings.some(item => item.severity === 'info'));
    } finally {
      if (previous === undefined) delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
      else process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = previous;
    }
  });
  it('keeps warnings valid, notices edits and never writes any project file', function () {
    fs.writeFileSync(path.join(root, 'index.html'), '<main>Content</main>');
    fs.writeFileSync(path.join(root, 'site.css'), '.absent {display:none}');
    const snapshot = () => fs.readdirSync(root).map(name => [name, fs.readFileSync(path.join(root, name)), fs.statSync(path.join(root, name)).mtimeMs]);
    const before = snapshot();
    assert.equal(validateTemplate('index.html', root).valid, true);
    assert.deepEqual(snapshot(), before);
    fs.writeFileSync(path.join(root, 'site.css'), '.absent {');
    const changed = snapshot();
    const result = validateTemplate('index.html', root);
    assert.equal(result.valid, false); assert.equal(result.findings[0].ruleId, 'PS-CSS-001');
    assert.deepEqual(snapshot(), changed);
  });
});
