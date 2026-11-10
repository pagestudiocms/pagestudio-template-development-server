'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadBlockContract } = require('../mcp/block-contracts');

function syncContracts({ source, projectRoot = process.env.PAGESTUDIO_PROJECT_ROOT || process.cwd() }) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('Provide --from <exported-contract-directory>');
  const project = fs.realpathSync(projectRoot);
  const sourceRoot = fs.realpathSync(source);
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== '1.0' || manifest.renderer !== 'cms-built-in') {
    throw new Error('Unsupported CMS contract manifest');
  }
  const names = Object.keys(manifest.blocks || {});
  if (!names.length) throw new Error('CMS contract manifest contains no enabled blocks');
  for (const name of names) loadBlockContract(name, sourceRoot);
  const destinationParent = path.join(project, '.pagestudio');
  fs.mkdirSync(destinationParent, { recursive: true });
  const destination = path.join(destinationParent, 'contracts');
  const stage = fs.mkdtempSync(path.join(destinationParent, '.contracts-stage-'));
  try {
    const files = new Set(['manifest.json']);
    for (const name of names) {
      files.add(`block-${name}.json`);
      files.add(`block-${name}.html`);
    }
    for (const file of files) {
      const sourceFile = path.join(sourceRoot, file);
      if (!fs.statSync(sourceFile).isFile() || fs.lstatSync(sourceFile).isSymbolicLink()) {
        throw new Error('Contract fixture must be a regular file: ' + file);
      }
      fs.copyFileSync(sourceFile, path.join(stage, file));
    }
    // Validate the staged bundle before replacing the previous version.
    for (const name of names) loadBlockContract(name, stage);
    const backup = path.join(destinationParent, '.contracts-backup-' + process.pid);
    if (fs.existsSync(backup)) throw new Error('Contract backup already exists: ' + backup);
    const hadExisting = fs.existsSync(destination);
    if (hadExisting) fs.renameSync(destination, backup);
    try {
      fs.renameSync(stage, destination);
    } catch (error) {
      if (hadExisting) fs.renameSync(backup, destination);
      throw error;
    }
    if (hadExisting) fs.rmSync(backup, { recursive: true, force: true });
    return { destination, blocks: names.length };
  } finally {
    if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true, force: true });
  }
}

module.exports = { syncContracts };
