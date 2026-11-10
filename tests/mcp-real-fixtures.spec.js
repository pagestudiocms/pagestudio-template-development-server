'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadBlockContract } = require('../src/mcp/block-contracts');

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
});
