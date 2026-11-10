'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { syncContracts } = require('../src/commands/contracts');
const { loadBlockContract, resolveContractsDirectory } = require('../src/mcp/block-contracts');

describe('project-local CMS contract sync', function () {
  let temp, source, project;
  beforeEach(function () {
    temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pagestudio-sync-'));
    source = path.join(temp, 'source');
    project = path.join(temp, 'template');
    fs.mkdirSync(source);
    fs.mkdirSync(project);
    fs.writeFileSync(path.join(source, 'manifest.json'), JSON.stringify({
      schemaVersion: '1.0', renderer: 'cms-built-in',
      blocks: { button: { fixtureStatus: 'rendered' } },
      fixtures: [{ name: 'button', status: 'rendered', input: 'block-button.json', html: 'block-button.html' }]
    }));
    fs.writeFileSync(path.join(source, 'block-button.json'), '[{"id":"sample"}]');
    fs.writeFileSync(path.join(source, 'block-button.html'), '<a>Button</a>');
  });
  afterEach(function () { fs.rmSync(temp, { recursive: true, force: true }); });
  it('installs verified contracts in the template root', function () {
    const result = syncContracts({ source, projectRoot: project });
    assert.equal(result.blocks, 1);
    assert.equal(loadBlockContract('button', result.destination).fixture.html, '<a>Button</a>');
  });
  it('resolves the project-local bundle by default and respects explicit override', function () {
    syncContracts({ source, projectRoot: project });
    const previousRoot = process.env.PAGESTUDIO_PROJECT_ROOT;
    const previousDir = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    try {
      process.env.PAGESTUDIO_PROJECT_ROOT = project;
      delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
      assert.equal(loadBlockContract('button').name, 'button');
      process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = source;
      assert.equal(resolveContractsDirectory(), source);
    } finally {
      if (previousRoot === undefined) delete process.env.PAGESTUDIO_PROJECT_ROOT;
      else process.env.PAGESTUDIO_PROJECT_ROOT = previousRoot;
      if (previousDir === undefined) delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
      else process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = previousDir;
    }
  });
  it('does not replace existing contracts if the source is invalid', function () {
    const result = syncContracts({ source, projectRoot: project });
    fs.rmSync(path.join(source, 'block-button.html'));
    assert.throws(() => syncContracts({ source, projectRoot: project }), /Missing PageStudio contract file/);
    assert.equal(loadBlockContract('button', result.destination).fixture.html, '<a>Button</a>');
  });
});
