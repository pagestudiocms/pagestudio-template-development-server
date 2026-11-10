'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadBlockContract } = require('../src/mcp/block-contracts');
const { analyzeStylesheets } = require('../src/mcp/stylesheet-analysis');

describe('real CMS fixture bundle (optional)', function () {
  const directory = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
  if (!directory) {
    it.skip('set PAGESTUDIO_BLOCK_CONTRACTS_DIR to run real-fixture integration checks', function () {});
    return;
  }
  it('loads every enabled rendered block from the CMS export', function () {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
    const names = Object.keys(manifest.blocks);
    assert.equal(names.length, 17, 'Expected 17 enabled CMS blocks in the current export');
    for (const name of names) {
      const result = loadBlockContract(name, directory);
      assert.equal(result.name, name);
      assert.ok(result.fixture.html.trim().length > 0, `Empty HTML for ${name}`);
    }
    const pricing = loadBlockContract('pricing-table', directory);
    assert.match(pricing.fixture.html, /Starter/);
    assert.match(pricing.fixture.html, /Buy it now/);
  });
  it('matches authored selectors against the complete real CMS export offline', function () {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-real-css-'));
    try {
      fs.writeFileSync(path.join(root, 'site.css'), '.text-left > a.btn {color:red} .bhb-pricing-table .price strong {color:blue}');
      const result = analyzeStylesheets(root);
      assert.equal(result.contracts.length, 17);
      assert.ok(result.selectors[0].matches.some(item => item.block === 'button'));
      assert.ok(result.selectors[1].matches.some(item => item.block === 'pricing-table'));
      assert.deepEqual(result.findings, []);
    } finally { fs.rmSync(root, {recursive:true, force:true}); }
  });
});
