'use strict';

const fs = require('node:fs');
const path = require('node:path');

function resolveContractsDirectory(directory) {
  if (directory) return path.resolve(directory);
  if (process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR) return path.resolve(process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR);
  return path.resolve(process.env.PAGESTUDIO_PROJECT_ROOT || process.cwd(), '.pagestudio', 'contracts');
}

function validateBlockName(name) {
  if (typeof name !== 'string' || !/^[a-z0-9-]+$/.test(name)) {
    throw new Error('block name must contain only lowercase letters, digits and hyphens');
  }
}

function createBlockContractLoader(directory) {
  const root = resolveContractsDirectory(directory);
  const readFile = (filename) => {
    try {
      return fs.readFileSync(path.join(root, filename), 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Missing PageStudio contract file: ${path.join(root, filename)}`, { cause: error });
      }
      throw error;
    }
  };
  const manifest = JSON.parse(readFile('manifest.json'));
  if (manifest.schemaVersion !== '1.0' || manifest.renderer !== 'cms-built-in') {
    throw new Error('Unsupported block contract manifest version or renderer');
  }
  return { manifest, load: name => readBlockContract(name, manifest, readFile) };
}

function readBlockContract(name, manifest, readFile) {
  validateBlockName(name);
  const block = manifest.blocks && Object.prototype.hasOwnProperty.call(manifest.blocks, name) ? manifest.blocks[name] : null;
  if (!block) throw new Error('Unknown or disabled PageStudio block: ' + name);
  const fixture = (manifest.fixtures || []).find(item => item.name === name);
  if (!fixture || fixture.status !== 'rendered' || !fixture.input || !fixture.html) {
    throw new Error('No successful HTML fixture for block: ' + name);
  }
  if (fixture.input !== `block-${name}.json` || fixture.html !== `block-${name}.html`) {
    throw new Error('Invalid fixture mapping for block: ' + name);
  }
  const readFixture = (file) => {
    if (typeof file !== 'string' || !/^block-[a-z0-9-]+\.(json|html)$/.test(file)) {
      throw new Error('Unsafe fixture filename');
    }
    return readFile(file);
  };
  return {
    schemaVersion: manifest.schemaVersion,
    renderer: manifest.renderer,
    name,
    contract: block,
    fixture: {
      input: JSON.parse(readFixture(fixture.input)),
      html: readFixture(fixture.html)
    }
  };
}

function loadBlockContract(name, directory) {
  validateBlockName(name);
  return createBlockContractLoader(directory).load(name);
}

module.exports = { loadBlockContract, resolveContractsDirectory, createBlockContractLoader };
