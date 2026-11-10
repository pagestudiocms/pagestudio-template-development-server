'use strict';

const mediaParser = require('postcss-media-query-parser').default;
const valueParser = require('postcss-value-parser');
const { findingLocation, mappingEvidence } = require('./diagnostics');
const PROPERTIES = new Set(['display', 'visibility', 'width', 'min-width', 'max-width', 'overflow-x']);

function pixels(source) {
  const nodes = valueParser(source).nodes.filter(node => node.type !== 'space' && node.type !== 'comment');
  if (nodes.length !== 1 || nodes[0].type !== 'word') return null;
  const unit = valueParser.unit(nodes[0].value);
  if (!unit || !['px', ''].includes(unit.unit.toLowerCase()) ||
      (unit.unit === '' && Number(unit.number) !== 0)) return null;
  const value = Number(unit.number);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function parseMedia(source) {
  try {
    const ast = mediaParser(source);
    if (!ast.nodes.length || ast.nodes.length > 32) return null;
    const intervals = [];
    for (const query of ast.nodes) {
      const nodes = query.nodes.slice();
      let index = 0, min = 0, max = Infinity;
      if (nodes[index] && nodes[index].type === 'keyword' && nodes[index].value.toLowerCase() === 'only') index++;
      if (nodes[index] && nodes[index].type === 'media-type') {
        if (!['all', 'screen'].includes(nodes[index].value.toLowerCase())) return null;
        index++;
        if (index < nodes.length) {
          if (nodes[index].type !== 'keyword' || nodes[index].value.toLowerCase() !== 'and') return null;
          index++;
          if (index === nodes.length) return null;
        }
      } else if (index) return null;
      if (!nodes.length) return null;
      while (index < nodes.length) {
        const feature = nodes[index++];
        if (feature.type !== 'media-feature-expression' || !feature.nodes || feature.nodes.length !== 3) return null;
        const [name, colon, value] = feature.nodes;
        if (name.type !== 'media-feature' || colon.type !== 'colon' || value.type !== 'value') return null;
        const property = name.value.toLowerCase();
        if (!['min-width', 'max-width', 'width'].includes(property)) return null;
        const width = pixels(value.value);
        if (width === null) return null;
        if (property !== 'max-width') min = Math.max(min, width);
        if (property !== 'min-width') max = Math.min(max, width);
        if (index < nodes.length) {
          const and = nodes[index++];
          if (and.type !== 'keyword' || and.value.toLowerCase() !== 'and' || index === nodes.length) return null;
        }
      }
      if (min <= max) intervals.push({ min, max });
    }
    return intervals;
  } catch (_) { return null; }
}

function intersect(left, right) {
  const result = [];
  for (const a of left) for (const b of right) {
    const min = Math.max(a.min, b.min), max = Math.min(a.max, b.max);
    if (min <= max) result.push({ min, max });
  }
  return result;
}
const serialIntervals = intervals => intervals.map(item => ({ min: item.min, max: Number.isFinite(item.max) ? item.max : null }));

function analyzeResponsive(analysis) {
  const findings = [], limitations = [], mediaQueries = [];
  const cache = new Map(), candidates = [];
  for (const record of analysis.selectors) {
    if (!record.media || !record.media.length) continue;
    let intervals = [{ min: 0, max: Infinity }];
    let supported = !(record.contexts || []).some(context => context.name !== 'layer');
    for (const query of record.media) {
      if (!cache.has(query)) {
        const parsed = parseMedia(query);
        cache.set(query, parsed);
        mediaQueries.push({ query, status: parsed === null ? 'unsupported' : 'supported', intervals: parsed === null ? [] : serialIntervals(parsed) });
      }
      const parsed = cache.get(query);
      if (parsed === null) supported = false;
      else {
        const combined = intersect(intervals, parsed);
        if (combined.length > 64) limitations.push(`${record.file}:${record.line}: nested media intersection truncated to 64 ranges.`);
        intervals = combined.slice(0, 64);
      }
    }
    if (!supported) {
      limitations.push(`${record.file}:${record.line}: responsive context is unsupported: ${record.media.join(' AND ')}.`);
      continue;
    }
    if (record.status !== 'matched' || !intervals.length) continue;
    const make = (ruleId, declaration, match, message, evidence, explanation, recommendation) => ({
      ruleId, severity: 'warning', ...findingLocation(record, declaration),
      selector: record.selector, block: match.block, message,
      evidence: { fixture: match.fixture, elements: match.evidence, media: record.media,
        intervals: serialIntervals(intervals), declaration, ...mappingEvidence(record, declaration), ...evidence }, explanation, recommendation
    });
    for (const declaration of record.declarations) {
      if (['width', 'min-width'].includes(declaration.property)) {
        const width = pixels(declaration.value);
        const narrower = intervals.filter(interval => width !== null && width > interval.max);
        if (narrower.length) for (const match of record.matches) findings.push(make('PS-RESP-001', declaration, match,
          'Fixed width may exceed the viewport in this media range.', { narrowerRanges: serialIntervals(narrower) },
          'The sampled element has a literal width or minimum width larger than a supported media range upper bound. Container sizing, max-width, flex and the cascade may compensate.',
          'Check this block at the reported viewport range and consider a fluid width, appropriate max-width or deliberate scrolling.'));
      }
    }
    if (candidates.length < 2000) candidates.push({ record, intervals, make });
    else limitations.push('Responsive overlap analysis is limited to 2,000 matching selector records.');
  }
  let comparisons = 0;
  outer: for (let index = 0; index < candidates.length; index++) {
    const current = candidates[index];
    for (let previous = 0; previous < index; previous++) {
      if (++comparisons > 10000) {
        limitations.push('Responsive overlap analysis stopped after 10,000 selector comparisons.');
        break outer;
      }
      const other = candidates[previous];
      if (current.record.file !== other.record.file || current.record.selector !== other.record.selector ||
          JSON.stringify(current.record.media) === JSON.stringify(other.record.media)) continue;
      const overlap = intersect(current.intervals, other.intervals);
      if (!overlap.length) continue;
      for (const declaration of current.record.declarations.filter(item => PROPERTIES.has(item.property))) {
        const prior = other.record.declarations.filter(item => item.property === declaration.property && item.value.trim() !== declaration.value.trim());
        if (!prior.length) continue;
        for (const match of current.record.matches.filter(item => other.record.matches.some(otherMatch => otherMatch.block === item.block))) {
          findings.push(current.make('PS-RESP-002', declaration, match, 'Different responsive values overlap for the same selector and property.', {
            overlap: serialIntervals(overlap), other: { file: other.record.file, media: other.record.media, declarations: prior }
          }, 'These supported media ranges can apply simultaneously. The cascade selects a value; this overlap may be intentional and is not a proven rendering defect.',
          'Review the overlapping breakpoint and declaration order in the preview; keep intentional overrides.'));
        }
      }
    }
  }
  return { findings, mediaQueries, limitations: [...new Set(limitations),
    'Responsive analysis supports inclusive pixel width/min-width/max-width queries joined by and or comma, with screen/all and optional only.',
    'Other units, range syntax, negation, non-width features, containers and feature-dependent contexts are unsupported; no browser rendering or visual correctness is inferred.',
    'Overlap checks compare identical selector text within the same file; stylesheet load order, specificity, shorthand equivalence and final cascade are not resolved.'
  ] };
}

module.exports = { analyzeResponsive, parseMedia };
