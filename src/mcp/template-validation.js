'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { analyzeStylesheets } = require('./stylesheet-analysis');
const { analyzeCompatibility } = require('./css-compatibility');
const { analyzeTemplateSyntax } = require('./template-syntax');
const { analyzeResponsive } = require('./responsive-analysis');
const { normalizeFinding } = require('./diagnostics');

const RULES = Object.freeze({
  MISSING_FILE: 'PS-TPL-001',
  INVALID_EXTENSION: 'PS-TPL-002',
  EMPTY_FILE: 'PS-TPL-003',
  INVALID_ROOT: 'PS-TPL-004',
  FILE_TOO_LARGE: 'PS-TPL-005'
});
const MAX_BYTES = 1024 * 1024;

function validateTemplate(file, root = process.env.PAGESTUDIO_PROJECT_ROOT || process.cwd()) {
  if (typeof file !== 'string' || !file.trim()) throw new Error('file must be a non-empty relative path');
  if (typeof root !== 'string' || !root.trim()) throw new Error('root must be a non-empty directory');
  const base = fs.realpathSync(root);
  if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) {
    throw new Error('file must be a relative path within the project root');
  }
  const target = path.resolve(base, file);
  if (target === base || !target.startsWith(base + path.sep)) {
    throw new Error('file must be within the project root');
  }
  const findings = [];
  const limitations = [
    'Passing validation does not guarantee CMS compatibility.',
    'Browser rendering, visual correctness and the complete CSS cascade are not validated.',
    'The requested HTML source and discovered project stylesheets are checked; stylesheet loading, inline style blocks, linked external assets and HTML includes are not resolved.'
  ];
  let analysis = { stylesheets: [], sourceStylesheets: [], assets: { mode: 'unavailable', expected: [], artifacts: [] }, contracts: [], selectors: [], mediaQueries: [] };
  const add = (ruleId, severity, message) => findings.push({ ruleId, severity, file, message });
  const result = () => ({
    schemaVersion: '1.0',
    file,
    valid: !findings.some(item => item.severity === 'error'),
    findings: findings.map(normalizeFinding),
    analysis,
    limitations: [...new Set(limitations)]
  });
  if (path.extname(file).toLowerCase() !== '.html') {
    add(RULES.INVALID_EXTENSION, 'error', 'Expected an HTML template file (.html)');
  }
  let stat;
  try {
    const realTarget = fs.realpathSync(target);
    if (!realTarget.startsWith(base + path.sep)) {
      add(RULES.INVALID_ROOT, 'error', 'File resolves outside project root');
      return result();
    }
    stat = fs.statSync(realTarget);
  } catch (error) {
    if (error.code === 'ENOENT') {
      add(RULES.MISSING_FILE, 'error', 'Template file does not exist');
      return result();
    }
    throw error;
  }
  if (!stat.isFile()) {
    add(RULES.INVALID_ROOT, 'error', 'Template path must refer to a regular file');
  } else if (stat.size > MAX_BYTES) {
    add(RULES.FILE_TOO_LARGE, 'error', 'Template exceeds the 1 MiB validation limit');
  } else {
    const source = fs.readFileSync(target, 'utf8');
    if (!source.trim()) add(RULES.EMPTY_FILE, 'warning', 'Template file is empty or whitespace only');
    if (path.extname(file).toLowerCase() === '.html') {
      const syntax = analyzeTemplateSyntax(source, file);
      const styles = analyzeStylesheets(base);
      const responsive = analyzeResponsive(styles);
      findings.push(...syntax.findings, ...styles.findings, ...analyzeCompatibility(styles), ...responsive.findings);
      limitations.push(...syntax.limitations, ...styles.limitations, ...responsive.limitations);
      analysis = { stylesheets: styles.stylesheets, sourceStylesheets: styles.sourceStylesheets, assets: styles.assets,
        contracts: styles.contracts, selectors: styles.selectors, mediaQueries: responsive.mediaQueries };
    }
  }
  return result();
}

module.exports = { validateTemplate, RULES };
