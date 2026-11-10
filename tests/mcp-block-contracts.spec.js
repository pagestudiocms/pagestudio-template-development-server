'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadBlockContract } = require('../src/mcp/block-contracts');

describe('CMS block contract loader', function () {
  let root;
  let manifest;
  beforeEach(function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pagestudio-contract-'));
    manifest = {
      schemaVersion: '1.0',
      renderer: 'cms-built-in',
      blocks: { button: { hasSampleData: true, fixtureStatus: 'rendered' } },
      fixtures: [{ name: 'button', status: 'rendered', input: 'block-button.json', html: 'block-button.html' }]
    };
    fs.writeFileSync(path.join(root, 'block-button.json'), JSON.stringify([{ id: 'fixed-id' }]));
    fs.writeFileSync(path.join(root, 'block-button.html'), '<a class="btn btn-default btn-md">Button text</a>');
    save();
  });
  afterEach(function () { fs.rmSync(root, { recursive: true, force: true }); });
  function save() { fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(manifest)); }

  it('returns the authoritative fixture and metadata', function () {
    const result = loadBlockContract('button', root);
    assert.equal(result.renderer, 'cms-built-in');
    assert.equal(result.fixture.input[0].id, 'fixed-id');
    assert.match(result.fixture.html, /btn-default/);
  });
  it('rejects invalid block names', function () {
    assert.throws(() => loadBlockContract('../secrets', root), /block name/);
  });
  it('rejects unknown or disabled blocks', function () {
    assert.throws(() => loadBlockContract('navbar', root), /Unknown or disabled/);
  });
  it('rejects unsupported schema and renderer', function () {
    manifest.schemaVersion = '2.0'; save();
    assert.throws(() => loadBlockContract('button', root), /Unsupported/);
    manifest.schemaVersion = '1.0'; manifest.renderer = 'tenant'; save();
    assert.throws(() => loadBlockContract('button', root), /Unsupported/);
  });
  it('rejects missing or failed fixtures', function () {
    manifest.fixtures[0].status = 'failed'; save();
    assert.throws(() => loadBlockContract('button', root), /No successful/);
  });
  it('rejects unsafe fixture paths', function () {
    manifest.fixtures[0].html = '../outside.html'; save();
    assert.throws(() => loadBlockContract('button', root), /Invalid fixture mapping/);
  });
  it('rejects a valid-looking fixture from another block', function () {
    manifest.fixtures[0].html = 'block-image.html'; save();
    assert.throws(() => loadBlockContract('button', root), /Invalid fixture mapping/);
  });
  it('reports missing manifests and missing fixture files', function () {
    fs.rmSync(path.join(root, 'manifest.json'));
    assert.throws(() => loadBlockContract('button', root), /Missing PageStudio contract file/);
    save();
    fs.rmSync(path.join(root, 'block-button.html'));
    assert.throws(() => loadBlockContract('button', root), /Missing PageStudio contract file/);
  });
});
