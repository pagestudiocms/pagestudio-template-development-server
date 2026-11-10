'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { analyzeStylesheets } = require('../src/mcp/stylesheet-analysis');
const { analyzeCompatibility } = require('../src/mcp/css-compatibility');

describe('CSS compatibility rule catalog', function () {
  let root, previous;
  beforeEach(function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-css-rules-'));
    previous = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = path.join(__dirname, 'fixtures/cms-contracts');
  });
  afterEach(function () {
    fs.rmSync(root, { recursive: true, force: true });
    if (previous === undefined) delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    else process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = previous;
  });
  function check(css) { fs.writeFileSync(path.join(root, 'site.css'), css); return analyzeCompatibility(analyzeStylesheets(root)); }
  it('PS-CSS-101 warns with block evidence and declaration location on visibility suppression', function () {
    for (const declaration of ['display:none', 'visibility:hidden', 'visibility:collapse', 'opacity:0']) {
      const result = check('h1 {\n  ' + declaration + ';\n}');
      assert.equal(result[0].ruleId, 'PS-CSS-101'); assert.equal(result[0].severity, 'warning');
      assert.equal(result[0].block, 'text-heading'); assert.equal(result[0].line, 2); assert.equal(result[0].column, 3);
      assert.ok(result[0].evidence.elements.length); assert.ok(result[0].recommendation);
    }
  });
  it('PS-CSS-101 does not warn for visible styling, unmatched selectors or unsupported dynamic selectors', function () {
    assert.deepEqual(check('h1 {display:block;opacity:1;visibility:visible} .absent {display:none} a:hover {display:none}'), []);
  });
  it('PS-CSS-102 describes intentional important overrides as informational', function () {
    const result = check('h1 {text-align:center !important}');
    assert.equal(result[0].ruleId, 'PS-CSS-102'); assert.equal(result[0].severity, 'info');
    assert.equal(result[0].evidence.conflicts[0].inlineValue, 'left');
  });
  it('PS-CSS-102 ignores ordinary overrides, identical values and properties with no inline evidence', function () {
    assert.deepEqual(check('h1 {text-align:center; text-align:left !important; color:red !important}'), []);
    const analysis = analyzeStylesheets(root);
    analysis.selectors[0].matches[0].evidence[0].attributes.style = 'text-align:left !important';
    analysis.selectors[0].declarations = [{property:'text-align',value:'center',important:true,line:1,column:1}];
    assert.deepEqual(analyzeCompatibility(analysis), []);
  });
  it('PS-CSS-103 warns on broad resets affecting sample elements', function () {
    for (const value of ['unset', 'initial', 'revert', 'revert-layer']) {
      const result = check('h1 {all:' + value + '}');
      assert.equal(result[0].ruleId, 'PS-CSS-103'); assert.equal(result[0].severity, 'warning');
    }
  });
  it('PS-CSS-103 ignores normal component styling and unmatched resets', function () {
    assert.deepEqual(check('h1 {all:inherit;color:red;margin:0} .absent {all:unset}'), []);
  });
});
