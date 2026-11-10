'use strict';

const postcss = require('postcss');

const RULES = Object.freeze({
  HIDDEN_CONTENT: 'PS-CSS-101',
  INLINE_OVERRIDE: 'PS-CSS-102',
  RESET: 'PS-CSS-103'
});

function analyzeCompatibility(analysis) {
  const findings = [];
  // Inline styles in the sampled evidence are parsed once per distinct string.
  const inlineCache = new Map();
  function inlineDeclarations(source) {
    if (!inlineCache.has(source)) {
      let declarations = [];
      try {
        const ast = postcss.parse(`fixture {${source}}`);
        declarations = ast.first.nodes.filter(node => node.type === 'decl');
      } catch (_) { /* Invalid sample inline CSS supplies no evidence of a conflict. */ }
      inlineCache.set(source, declarations);
    }
    return inlineCache.get(source);
  }
  for (const record of analysis.selectors) {
    if (record.status !== 'matched') continue;
    for (const match of record.matches) {
      for (const declaration of record.declarations) {
        const value = declaration.value.trim().toLowerCase();
        const add = (ruleId, severity, message, evidence, explanation, recommendation) => findings.push({
          ruleId, severity, file: record.file, line: declaration.line, column: declaration.column,
          selector: record.selector, block: match.block, message, evidence: {
            fixture: match.fixture, elements: match.evidence, declaration, media: record.media, ...evidence
          }, explanation, recommendation
        });
        if ((declaration.property === 'display' && value === 'none') ||
            (declaration.property === 'visibility' && ['hidden', 'collapse'].includes(value)) ||
            (declaration.property === 'opacity' && ['0', '0%', '0.0'].includes(value))) {
          add(RULES.HIDDEN_CONTENT, 'warning', 'Declaration may hide sampled CMS content.', {},
            'This selector matches rendered CMS elements and declares a value that suppresses visibility. Conditional styling or a later declaration may make this intentional.',
            'Confirm the matched block should be hidden in this state and check its visible alternative in the preview.');
        }
        if (declaration.property === 'all' && ['unset', 'initial', 'revert', 'revert-layer'].includes(value)) {
          add(RULES.RESET, 'warning', 'Broad reset may remove CMS component styling.', {},
            'The all shorthand resets many properties on matched sample elements. Contracts do not require particular visual defaults, so this is a risk rather than a violation.',
            'Check the reset scope and restore the component properties needed by the design.');
        }
        if (declaration.important) {
          const conflicts = match.evidence.flatMap(element => inlineDeclarations(element.attributes.style || '')
            .filter(inline => !inline.important && inline.prop.toLowerCase() === declaration.property && inline.value.trim() !== declaration.value.trim())
            .map(inline => ({ element, property: inline.prop, inlineValue: inline.value })));
          if (conflicts.length) add(RULES.INLINE_OVERRIDE, 'info', 'Important declaration overrides sampled normal inline styling when applicable.', { conflicts },
            'The fixture contains a different normal inline declaration for this property. An applicable author !important declaration takes precedence; this may be an intentional override.',
            'Confirm overriding the fixture inline value is intentional; no change is required for intentional overrides.');
        }
      }
    }
  }
  return findings;
}

module.exports = { analyzeCompatibility, RULES };
