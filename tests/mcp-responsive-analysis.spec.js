'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { analyzeStylesheets } = require('../src/mcp/stylesheet-analysis');
const { analyzeResponsive, parseMedia } = require('../src/mcp/responsive-analysis');

describe('Bounded responsive analysis', function () {
  let root, previous;
  beforeEach(function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-responsive-'));
    previous = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = path.join(__dirname, 'fixtures/cms-contracts');
  });
  afterEach(function () {
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    else process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = previous;
  });
  function check(css) { fs.writeFileSync(path.join(root, 'site.css'), css); return analyzeResponsive(analyzeStylesheets(root)); }
  it('parses media lists, inclusive breakpoints and intersected width features', function () {
    assert.deepEqual(parseMedia('only screen and (min-width:400px) and (max-width:600px), (width:800px)'), [{min:400,max:600},{min:800,max:800}]);
    assert.deepEqual(parseMedia('(min-width:700px) and (max-width:600px)'), []);
  });
  it('PS-RESP-001 warns for fixture widths above a bounded viewport range with precise evidence', function () {
    const result = check('@media (max-width:600px) {\n h1 { min-width:900px } }');
    assert.equal(result.findings[0].ruleId, 'PS-RESP-001'); assert.equal(result.findings[0].severity, 'warning');
    assert.equal(result.findings[0].block, 'text-heading'); assert.equal(result.findings[0].line, 2);
    assert.deepEqual(result.findings[0].evidence.narrowerRanges, [{min:0,max:600}]);
  });
  it('PS-RESP-001 ignores fluid, equal, unbounded, unmatched and non-applicable widths', function () {
    const result = check('@media (max-width:600px) { h1 { width:100%;min-width:600px } .absent {width:900px} } @media (min-width:601px) {h1 {width:900px}} @media (min-width:700px) and (max-width:600px) {h1 {width:999px}}');
    assert.deepEqual(result.findings, []);
  });
  it('intersects nested media instead of treating them independently', function () {
    assert.deepEqual(check('@media (max-width:900px) {@media (min-width:1000px) {h1 {width:2000px}}}').findings, []);
    assert.equal(check('@media (max-width:900px) {@media (max-width:600px) {h1 {width:800px}}}').findings[0].ruleId, 'PS-RESP-001');
  });
  it('PS-RESP-002 warns on different responsive values in overlapping inclusive ranges', function () {
    const result = check('@media (max-width:600px) {h1 {display:none}}\n@media (min-width:600px) {h1 {display:block}}');
    assert.equal(result.findings[0].ruleId, 'PS-RESP-002');
    assert.deepEqual(result.findings[0].evidence.overlap, [{min:600,max:600}]);
    assert.equal(result.findings[0].evidence.other.declarations[0].value, 'none');
  });
  it('PS-RESP-002 ignores disjoint ranges, equal values and normal base-to-responsive overrides', function () {
    for (const css of ['@media (max-width:600px) {h1 {display:none}} @media (min-width:601px) {h1 {display:block}}',
      '@media (max-width:600px) {h1 {display:block}} @media (min-width:500px) {h1 {display:block}}',
      'h1 {display:none} @media (min-width:500px) {h1 {display:block}}']) assert.deepEqual(check(css).findings, []);
  });
  it('records unsupported units, features, range syntax, negation and malformed grammar without inventing errors', function () {
    for (const query of ['(max-width:40em)', '(width <= 600px)', 'not screen and (max-width:600px)',
      '(max-width:600px) and (orientation:portrait)', '(max-width:600px) and', 'print', '(max-width:600px) or (min-width:100px)']) {
      const result = check('@media ' + query + ' {h1 {width:900px}}');
      assert.deepEqual(result.findings, []); assert.equal(result.mediaQueries[0].status, 'unsupported', query);
    }
    const result = check('@supports (display:grid) {@media (max-width:600px) {h1 {width:900px}}}');
    assert.deepEqual(result.findings, []); assert.match(result.limitations.join(' '), /context is unsupported/);
  });
});
