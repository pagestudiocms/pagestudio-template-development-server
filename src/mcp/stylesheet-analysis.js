'use strict';

const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const scss = require('postcss-scss');
const selectorParser = require('postcss-selector-parser');
const { parseDocument } = require('htmlparser2');
const { selectAll } = require('css-select');
const { loadBlockContract, resolveContractsDirectory } = require('./block-contracts');

const MAX_BYTES = 1024 * 1024;
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 10 * MAX_BYTES;
const IGNORED = new Set(['node_modules', 'vendor', 'build', 'dist', 'coverage']);
// Only structural, static pseudo classes can be proven against an HTML snapshot.
const STATIC_PSEUDOS = new Set([':is', ':where', ':not', ':has', ':root', ':empty',
  ':first-child', ':last-child', ':only-child', ':nth-child', ':nth-last-child',
  ':first-of-type', ':last-of-type', ':only-of-type', ':nth-of-type', ':nth-last-of-type']);

function loadFixtures(base, limitations) {
  const directory = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR
    ? resolveContractsDirectory() : path.join(base, '.pagestudio', 'contracts');
  let manifest;
  try {
    const filename = path.join(directory, 'manifest.json');
    if (fs.statSync(filename).size > MAX_BYTES) throw new Error('Manifest exceeds 1 MiB');
    manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (manifest.schemaVersion !== '1.0' || manifest.renderer !== 'cms-built-in' ||
        !manifest.blocks || typeof manifest.blocks !== 'object' || Array.isArray(manifest.blocks) ||
        !Array.isArray(manifest.fixtures)) throw new Error('Unsupported or incomplete contract manifest');
  } catch (error) {
    limitations.push(`Contract fixtures unavailable: ${error.message}`);
    return [];
  }
  const fixtures = [];
  const names = Object.keys(manifest.blocks).sort();
  if (names.length > MAX_FILES) limitations.push('Only the first 500 contract blocks are analyzed.');
  let bytes = 0;
  for (const name of names.slice(0, MAX_FILES)) {
    try {
      if (!/^[a-z0-9-]+$/.test(name)) throw new Error('Unsafe block name');
      for (const extension of ['json', 'html']) {
        const filename = path.join(directory, `block-${name}.${extension}`);
        const stat = fs.lstatSync(filename);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) throw new Error('Unsafe or oversized fixture');
        bytes += stat.size;
      }
      if (bytes > MAX_TOTAL_BYTES) throw new Error('Contract fixtures exceed 10 MiB analysis budget');
      const contract = loadBlockContract(name, directory);
      if (!contract.fixture.html.trim()) throw new Error('Empty rendered fixture');
      fixtures.push({ name, file: `block-${name}.html`, dom: parseDocument(contract.fixture.html) });
    } catch (error) {
      limitations.push(`Skipped contract ${name}: ${error.message}`);
    }
    if (bytes > MAX_TOTAL_BYTES) break;
  }
  return fixtures;
}

function discoverStylesheets(base, limitations) {
  const files = [];
  let entries = 0;
  function visit(directory) {
    if (entries >= 10000 || files.length >= MAX_FILES) return;
    let children;
    try { children = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }
    catch (error) { limitations.push(`Cannot discover stylesheets in ${path.relative(base, directory) || '.'}: ${error.code}`); return; }
    for (const child of children) {
      if (++entries > 10000 || files.length >= MAX_FILES) break;
      if (child.name.startsWith('.') || child.isSymbolicLink()) continue;
      const filename = path.join(directory, child.name);
      if (child.isDirectory() && !IGNORED.has(child.name)) visit(filename);
      else if (child.isFile() && /\.(css|scss)$/i.test(child.name)) files.push(filename);
    }
  }
  visit(base);
  if (entries >= 10000 || files.length >= MAX_FILES) limitations.push('Stylesheet discovery stopped at 10,000 entries or 500 stylesheets.');
  return files.sort();
}

function location(node) {
  return { line: node.source.start.line, column: node.source.start.column };
}

function analyzeStylesheets(root) {
  const base = fs.realpathSync(root);
  const limitations = [
    'Unmatched selectors are observations, not invalid CSS: fixtures are finite HTML fragments.',
    'Hidden directories, dependencies, build, dist, coverage and symlinks are excluded from stylesheet discovery.',
    'SCSS is parsed without evaluation; imports, mixins, variables, interpolation and nested selectors are not expanded.',
    'Pseudo elements and dynamic pseudo classes are unsupported; browser layout and cascade are not validated.'
  ];
  const fixtures = loadFixtures(base, limitations);
  const selectors = [];
  const findings = [];
  const stylesheets = [];
  let bytes = 0;
  for (const filename of discoverStylesheets(base, limitations)) {
    const file = path.relative(base, filename).split(path.sep).join('/');
    let ast;
    try {
      const size = fs.statSync(filename).size;
      if (size > MAX_BYTES || bytes + size > MAX_TOTAL_BYTES) {
        limitations.push(`Skipped ${file}: exceeds 1 MiB per file or 10 MiB total stylesheet budget.`);
        continue;
      }
      bytes += size;
      const source = fs.readFileSync(filename, 'utf8');
      ast = path.extname(file).toLowerCase() === '.scss' ? scss.parse(source, { from: filename }) : postcss.parse(source, { from: filename });
    } catch (error) {
      findings.push({ ruleId: 'PS-CSS-001', severity: 'error', file, line: error.line || null,
        column: error.column || null, message: 'Stylesheet could not be parsed.', evidence: error.reason || error.message,
        explanation: 'The stylesheet parser rejected this source; compatibility analysis for this file is unavailable.',
        recommendation: 'Correct the stylesheet syntax and run validation again.' });
      continue;
    }
    stylesheets.push(file);
    ast.walkAtRules(node => {
      if (['import', 'use', 'forward', 'include'].includes(node.name.toLowerCase())) limitations.push(`${file}:${node.source.start.line}: @${node.name} is not resolved or executed.`);
    });
    ast.walkRules(rule => {
      const ancestors = [];
      for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) ancestors.push(parent);
      if (ancestors.some(node => node.type === 'atrule' && /keyframes$/i.test(node.name))) return;
      let parsed;
      try { parsed = selectorParser().astSync(rule.selector); }
      catch (error) {
        selectors.push({ file, ...location(rule), selector: rule.selector, status: 'unsupported', matches: [], reason: `Selector parser: ${error.message}` });
        return;
      }
      for (const selector of parsed.nodes) {
        const record = { file, ...location(rule), selector: selector.toString().trim(), status: 'unmatched', matches: [],
          media: ancestors.filter(node => node.type === 'atrule' && node.name.toLowerCase() === 'media').reverse().map(node => node.params),
          contexts: ancestors.filter(node => node.type === 'atrule' && node.name.toLowerCase() !== 'media').map(node => ({ name: node.name.toLowerCase(), params: node.params })),
          declarations: (rule.nodes || []).filter(node => node.type === 'decl').map(node => ({ property: node.prop.toLowerCase(), value: node.value,
            important: Boolean(node.important), ...location(node) })) };
        const context = ancestors.some(node => node.type === 'rule' ||
          (node.type === 'atrule' && !['media', 'supports', 'layer', 'container', 'document', 'scope', 'starting-style'].includes(node.name.toLowerCase())));
        let unsupported = context;
        selector.walk(node => {
          if (node.type === 'nesting' || node.type === 'comment' || (node.type === 'pseudo' && !STATIC_PSEUDOS.has(node.value.toLowerCase())) ||
              node.namespace || (node.type === 'combinator' && ![' ', '>', '+', '~'].includes(node.value))) unsupported = true;
        });
        if (record.selector.includes('#{') || record.selector.includes('$')) unsupported = true;
        if (unsupported) {
          record.status = 'unsupported';
          record.reason = 'Selector requires dynamic state, namespace, pseudo element, nesting or SCSS evaluation.';
        } else {
          try {
            for (const fixture of fixtures) {
              const elements = selectAll(record.selector, fixture.dom, { xmlMode: false });
              if (elements.length) record.matches.push({ block: fixture.name, fixture: fixture.file, count: elements.length,
                evidence: elements.slice(0, 3).map(element => ({ tag: element.name, attributes: { ...element.attribs } })) });
            }
            // Validate selector engine support even when no fixtures are available.
            if (!fixtures.length) selectAll(record.selector, parseDocument(''));
            if (record.matches.length) record.status = 'matched';
          } catch (error) {
            record.status = 'unsupported'; record.matches = []; record.reason = error.message;
          }
        }
        selectors.push(record);
      }
    });
  }
  return { stylesheets, contracts: fixtures.map(fixture => fixture.name), selectors, findings, limitations: [...new Set(limitations)] };
}

module.exports = { analyzeStylesheets };
