'use strict';

const FILE_ACTIONS = {
  'PS-TPL-001': 'Check the project-relative path and project root.',
  'PS-TPL-002': 'Select an HTML template with the .html extension.',
  'PS-TPL-003': 'Add the intended template content.',
  'PS-TPL-004': 'Select a regular file that resolves inside the project root.',
  'PS-TPL-005': 'Validate an HTML source file no larger than 1 MiB.'
};

function normalizeFinding(finding) {
  return {
    ruleId: finding.ruleId,
    severity: finding.severity,
    file: finding.file,
    line: finding.line || null,
    column: finding.column || null,
    selector: finding.selector || null,
    construct: finding.construct || null,
    block: finding.block || null,
    message: finding.message,
    evidence: typeof finding.evidence === 'string' ? { observation: finding.evidence }
      : finding.evidence || { file: finding.file, observation: finding.message },
    explanation: finding.explanation || finding.message,
    recommendation: finding.recommendation || FILE_ACTIONS[finding.ruleId]
  };
}

function findingLocation(record, declaration) {
  return declaration.original || { file: record.file, line: declaration.line, column: declaration.column };
}

function mappingEvidence(record, declaration) {
  return declaration.original ? { generated: { file: record.file, line: declaration.line, column: declaration.column },
    original: declaration.original, sourceMap: record.sourceMap } : {};
}

module.exports = { normalizeFinding, findingLocation, mappingEvidence };
