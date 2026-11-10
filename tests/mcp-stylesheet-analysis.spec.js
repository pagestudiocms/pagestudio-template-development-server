'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { analyzeStylesheets } = require('../src/mcp/stylesheet-analysis');

describe('Contract-aware stylesheet discovery and matching', function () {
  let root, previous;
  beforeEach(function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-css-'));
    previous = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    fs.mkdirSync(path.join(root, '.pagestudio'), { recursive: true });
    fs.cpSync(path.join(__dirname, 'fixtures/cms-contracts'), path.join(root, '.pagestudio/contracts'), { recursive: true });
  });
  afterEach(function () {
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    else process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = previous;
  });
  const write = (root, file, source) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), source); };
  it('matches selector lists, attributes, combinators and structural pseudos against actual CMS HTML', function () {
    write(root, 'css/site.css', '\n.text-left > a.btn, .bhb-pricing-table .price strong:first-child { color:red }\nh1[style] { color:blue }\n.absent { margin:0 }');
    const result = analyzeStylesheets(root);
    assert.deepEqual(result.selectors.map(item => item.status), ['matched', 'unmatched', 'matched', 'unmatched']);
    const match = result.selectors[0];
    assert.equal(match.file, 'css/site.css'); assert.equal(match.line, 2); assert.equal(match.column, 1);
    assert.equal(match.matches[0].block, 'button');
    assert.equal(match.matches[0].evidence[0].attributes.class, 'btn btn-default btn-md');
    assert.deepEqual(result.findings, []);
  });
  it('discovers SCSS without executing imports or inventing matches for nesting and state', function () {
    write(root, 'site.scss', '@use "missing";\n.btn {color:red; &:hover {color:blue}}\n#{ $selector } {color:red}\na:hover, a::before {color:red}\n@keyframes fade { from {opacity:0} }');
    const result = analyzeStylesheets(root);
    assert.deepEqual(result.selectors, []);
    assert.equal(result.sourceStylesheets[0].constructs[0].name, '@use');
    assert.ok(result.sourceStylesheets[0].selectors.some(item => item.selector === '&:hover'));
    assert.ok(result.limitations.some(item => item.includes('SCSS source')));
    assert.ok(result.findings.some(item => item.ruleId === 'PS-ASSET-001'));
  });
  it('reports each selector location within multiline lists', function () {
    write(root, 'site.css', '\n.a,\n  h1[style], .btn {color:red}');
    assert.deepEqual(analyzeStylesheets(root).selectors.map(item => [item.line, item.column]), [[2,1], [3,3], [3,14]]);
  });
  it('skips dependencies, generated files, hidden paths and symlinks', function () {
    for (const dir of ['node_modules', 'build', 'dist', 'vendor', '.hidden']) write(root, dir + '/ignore.css', '.btn{}');
    write(root, 'a.css', '.btn{}'); fs.symlinkSync(path.join(root, 'a.css'), path.join(root, 'link.css'));
    assert.deepEqual(analyzeStylesheets(root).stylesheets, ['a.css']);
  });
  it('reports parse errors and preserves other files', function () {
    write(root, 'bad.css', '.btn {'); write(root, 'good.css', '.btn{}');
    const result = analyzeStylesheets(root);
    assert.equal(result.findings[0].ruleId, 'PS-CSS-001');
    assert.equal(result.findings[0].line, 1);
    assert.deepEqual(result.stylesheets, ['good.css']);
  });
  it('handles missing, malformed and incomplete contracts gracefully', function () {
    write(root, 'site.css', '.btn{}');
    const manifest = path.join(root, '.pagestudio/contracts/manifest.json');
    for (const source of ['bad json', '{}']) {
      fs.writeFileSync(manifest, source);
      const result = analyzeStylesheets(root);
      assert.equal(result.selectors[0].status, 'unmatched');
      assert.match(result.limitations.join(' '), /fixtures unavailable/);
    }
    fs.unlinkSync(manifest);
    assert.deepEqual(analyzeStylesheets(root).contracts, []);
  });
  it('preserves successful fixtures when one is incomplete and respects the explicit directory override', function () {
    fs.unlinkSync(path.join(root, '.pagestudio/contracts/block-button.html'));
    assert.deepEqual(analyzeStylesheets(root).contracts, ['pricing-table', 'text-heading']);
    process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = path.join(__dirname, 'fixtures/cms-contracts');
    assert.deepEqual(analyzeStylesheets(root).contracts, ['button', 'pricing-table', 'text-heading']);
  });
  it('bounds large files and returns deterministic results without changing project files', function () {
    write(root, 'huge.css', ' '.repeat(1024 * 1024 + 1)); write(root, 'site.css', '.btn{}');
    const before = fs.readFileSync(path.join(root, 'site.css'));
    const first = analyzeStylesheets(root);
    assert.deepEqual(first, analyzeStylesheets(root));
    assert.deepEqual(before, fs.readFileSync(path.join(root, 'site.css')));
    assert.match(first.limitations.join(' '), /Skipped huge.css/);
  });
});
