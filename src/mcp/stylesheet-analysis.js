'use strict';

const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const scss = require('postcss-scss');
const selectorParser = require('postcss-selector-parser');
const { parseDocument } = require('htmlparser2');
const { compile, selectAll } = require('css-select');
const { createBlockContractLoader, resolveContractsDirectory } = require('./block-contracts');
const { discoverCssAssets, readLocal } = require('./css-assets');
const { loadSourceMap, assessFreshness } = require('./css-source-maps');

const MAX_BYTES = 1024 * 1024;
const MAX_FILES = 500;
const MAX_TOTAL_BYTES = 10 * MAX_BYTES;
const MAX_SELECTORS = 5000;
// Only structural, static pseudo classes can be proven against an HTML snapshot.
const STATIC_PSEUDOS = new Set([':is', ':where', ':not', ':has', ':root', ':empty',
  ':first-child', ':last-child', ':only-child', ':nth-child', ':nth-last-child',
  ':first-of-type', ':last-of-type', ':only-of-type', ':nth-of-type', ':nth-last-of-type']);

function loadFixtures(base, limitations) {
  const directory = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR
    ? resolveContractsDirectory() : path.join(base, '.pagestudio', 'contracts');
  let manifest, loader;
  try {
    const filename = path.join(directory, 'manifest.json');
    if (fs.statSync(filename).size > MAX_BYTES) throw new Error('Manifest exceeds 1 MiB');
    loader = createBlockContractLoader(directory);
    manifest = loader.manifest;
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
      const contract = loader.load(name);
      if (!contract.fixture.html.trim()) throw new Error('Empty rendered fixture');
      fixtures.push({ name, file: `block-${name}.html`, dom: parseDocument(contract.fixture.html) });
    } catch (error) {
      limitations.push(`Skipped contract ${name}: ${error.message}`);
    }
    if (bytes > MAX_TOTAL_BYTES) break;
  }
  return fixtures;
}

function location(node) {
  return { line: node.source.start.line, column: node.source.start.column };
}

function selectorLocation(rule, selector) {
  const relative = selector.first && selector.first.source.start;
  if (!relative) return location(rule);
  return { line: rule.source.start.line + relative.line - 1,
    column: relative.line === 1 ? rule.source.start.column + relative.column - 1 : relative.column };
}

function analyzeStylesheets(root) {
  const base = fs.realpathSync(root);
  const limitations = [
    'Unmatched selectors are observations, not invalid CSS: fixtures are finite HTML fragments.',
    'Source discovery excludes hidden/dependency/generated directories and symlinks; configured compiled CSS outputs are discovered separately.',
    'SCSS source is parsed for authoring diagnostics only. Fixture matching, compatibility and responsive analysis use existing compiled or plain CSS; no build is run.',
    'Pseudo elements and dynamic pseudo classes are unsupported; browser layout and cascade are not validated.'
  ];
  const fixtures = loadFixtures(base, limitations);
  const selectors = [];
  const assets = discoverCssAssets(base);
  limitations.push(...assets.limitations);
  const findings = [...assets.findings];
  const stylesheets = [], sourceStylesheets = [], artifacts = [];
  const runtime = new Set(assets.stylesheets);
  let bytes = 0, sourceSelectorCount = 0, sourceConstructCount = 0;
  for (const filename of [...new Set([...assets.sources, ...assets.stylesheets])]) {
    const file = path.relative(base, filename).split(path.sep).join('/');
    let ast;
    try {
      const size = fs.statSync(filename).size;
      if (size > MAX_BYTES || bytes + size > MAX_TOTAL_BYTES) {
        limitations.push(`Skipped ${file}: exceeds 1 MiB per file or 10 MiB total stylesheet budget.`);
        continue;
      }
      bytes += size;
      const { text: source } = readLocal(base, filename);
      // Handle maps ourselves so malformed maps never prevent CSS parsing.
      ast = path.extname(file).toLowerCase() === '.scss' ? scss.parse(source, { from: filename, map: false }) : postcss.parse(source, { from: filename, map: false });
    } catch (error) {
      if (error.name !== 'CssSyntaxError') {
        limitations.push(`Skipped ${file}: stylesheet could not be read (${error.code || error.message}).`);
        continue;
      }
      findings.push({ ruleId: 'PS-CSS-001', severity: 'error', file, line: error.line || null,
        column: error.column || null, message: 'Stylesheet could not be parsed.', evidence: error.reason || error.message,
        explanation: 'The stylesheet parser rejected this source; compatibility analysis for this file is unavailable.',
        recommendation: 'Correct the stylesheet syntax and run validation again.' });
      continue;
    }
    if (assets.sources.includes(filename)) {
      const constructs = [], authoringSelectors = [];
      ast.walkAtRules(node => {
        if (['import', 'use', 'forward', 'include', 'mixin', 'media'].includes(node.name.toLowerCase()) && sourceConstructCount < MAX_SELECTORS) {
          constructs.push({ name: '@' + node.name, params: node.params, ...location(node) }); sourceConstructCount++;
        }
      });
      ast.walkRules(rule => {
        if (sourceSelectorCount < MAX_SELECTORS) {
          authoringSelectors.push({ selector: rule.selector, ...location(rule), status: 'authoring-only' }); sourceSelectorCount++;
        }
      });
      sourceStylesheets.push({ file, syntax: path.extname(file).slice(1).toLowerCase(), constructs, selectors: authoringSelectors });
    }
    if (!runtime.has(filename)) continue;
    stylesheets.push(file);
    const mapper = loadSourceMap(base, file, ast, limitations);
    if (assets.mode === 'compiled') {
      const freshness = assessFreshness(base, file, assets, mapper, limitations);
      if (freshness.finding) findings.push(freshness.finding);
      artifacts.push({ file, sourceMap: mapper.map, freshness: freshness.status });
      if (!mapper.map) limitations.push(`${file}: no usable source map; SCSS attribution is unavailable.`);
    }
    ast.walkAtRules(node => {
      if (node.name.toLowerCase() === 'import') limitations.push(`${file}:${node.source.start.line}: CSS @import is not followed.`);
    });
    ast.walkRules(rule => {
      if (selectors.length >= MAX_SELECTORS) {
        limitations.push('Selector analysis stopped at 5,000 records.');
        return false;
      }
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
        if (selectors.length >= MAX_SELECTORS) {
          limitations.push('Selector analysis stopped at 5,000 records.');
          break;
        }
        const record = { file, ...selectorLocation(rule, selector), selector: selector.toString().trim(), status: 'unmatched', matches: [],
          media: ancestors.filter(node => node.type === 'atrule' && node.name.toLowerCase() === 'media').reverse().map(node => node.params),
          contexts: ancestors.filter(node => node.type === 'atrule' && node.name.toLowerCase() !== 'media').map(node => ({ name: node.name.toLowerCase(), params: node.params })),
          declarations: (rule.nodes || []).filter(node => node.type === 'decl').map(node => ({ property: node.prop.toLowerCase(), value: node.value,
            important: Boolean(node.important), ...location(node), original: mapper.original(location(node)) })) };
        record.original = mapper.original(record);
        record.sourceMap = mapper.map;
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
            // Compile once per source selector, then reuse against every fixture DOM.
            const query = compile(record.selector, { xmlMode: false });
            for (const fixture of fixtures) {
              const elements = selectAll(query, fixture.dom, { xmlMode: false });
              if (elements.length) record.matches.push({ block: fixture.name, fixture: fixture.file, count: elements.length,
                evidence: elements.slice(0, 3).map(element => ({ tag: element.name, attributes: { ...element.attribs } })) });
            }
            if (record.matches.length) record.status = 'matched';
          } catch (error) {
            record.status = 'unsupported'; record.matches = []; record.reason = error.message;
          }
        }
        selectors.push(record);
      }
    });
  }
  if (sourceSelectorCount >= MAX_SELECTORS || sourceConstructCount >= MAX_SELECTORS) limitations.push('Source authoring records are limited to 5,000 selectors and 5,000 constructs.');
  return { stylesheets, sourceStylesheets, assets: { mode: assets.mode, expected: assets.expected, artifacts }, contracts: fixtures.map(fixture => fixture.name), selectors, findings, limitations: [...new Set(limitations)] };
}

module.exports = { analyzeStylesheets };
