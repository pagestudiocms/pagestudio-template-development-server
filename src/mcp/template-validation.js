'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
  const add = (ruleId, severity, message) => findings.push({ ruleId, severity, file, message });
  const result = () => ({
    schemaVersion: '1.0',
    file,
    valid: !findings.some(item => item.severity === 'error'),
    findings,
    limitations: [
      'Checks are limited to file accessibility, extension and non-empty content.',
      'CMS template syntax, CSS selectors, rendering and responsive behavior are not validated.',
      'Passing validation does not guarantee CMS compatibility.'
    ]
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
  } else if (!fs.readFileSync(target, 'utf8').trim()) {
    add(RULES.EMPTY_FILE, 'warning', 'Template file is empty or whitespace only');
  }
  return result();
}

module.exports = { validateTemplate, RULES };
