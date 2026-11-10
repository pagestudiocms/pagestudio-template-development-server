'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { TraceMap, originalPositionFor } = require('@jridgewell/trace-mapping');
const { localPath, readLocal, relative } = require('./css-assets');

function sourcePath(base, mapFile, source) {
  if (source.startsWith('webpack://')) {
    const pathname = decodeURIComponent(new URL(source).pathname).replace(/^\/(?:\.\/)?/, '');
    return localPath(base, pathname);
  }
  if (source.startsWith('file://')) return localPath(base, decodeURIComponent(new URL(source).pathname));
  if (/^[a-z][a-z\d+.-]*:/i.test(source)) throw new Error('Non-local source map source');
  return localPath(base, path.resolve(path.dirname(mapFile), decodeURIComponent(source)));
}

function loadSourceMap(base, cssFile, ast, limitations) {
  const css = path.join(base, cssFile);
  let reference;
  ast.walkComments(comment => {
    const match = /^[@#]\s*sourceMappingURL\s*=\s*(\S+)\s*$/.exec(comment.text.trim());
    if (match) reference = match[1];
  });
  let mapFile = css + '.map', raw, tracer;
  const inputs = [], snapshots = [], syntheticSources = new Set(), localSources = new Map();
  try {
    if (reference && reference.startsWith('data:')) {
      const match = /^data:application\/json(?:;charset=[^;,]+)?;base64,([a-z\d+/=]+)$/i.exec(reference);
      if (!match || match[1].length > 7 * 1024 * 1024) throw new Error('Unsupported or oversized inline source map');
      const decoded = Buffer.from(match[1], 'base64');
      if (decoded.length > 5 * 1024 * 1024) throw new Error('Inline source map exceeds 5 MiB');
      raw = JSON.parse(decoded.toString('utf8'));
    } else {
      if (reference) {
        if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(reference) || reference.includes('?') || reference.includes('#')) throw new Error('Non-local source map reference');
        mapFile = localPath(base, path.resolve(path.dirname(css), decodeURIComponent(reference)));
      }
      if (!fs.existsSync(mapFile) && !reference) return { map: null, inputs, snapshots, original: () => null };
      raw = JSON.parse(readLocal(base, mapFile, 5 * 1024 * 1024).text);
    }
    if (!raw || raw.version !== 3 || !Array.isArray(raw.sources) || raw.sources.length > 1000 ||
        typeof raw.mappings !== 'string' || raw.sections || !Array.isArray(raw.names) ||
        (raw.sourcesContent && (!Array.isArray(raw.sourcesContent) || raw.sourcesContent.length !== raw.sources.length))) throw new Error('Unsupported or invalid version 3 source map');
    if (typeof raw.file === 'string' && path.basename(raw.file) !== path.basename(css)) throw new Error('Source map file does not identify this CSS artifact');
    tracer = new TraceMap(raw);
    for (let index = 0; index < tracer.resolvedSources.length; index++) {
      try {
        const filename = sourcePath(base, mapFile, tracer.resolvedSources[index]);
        inputs.push(filename);
        if (fs.existsSync(filename)) localSources.set(tracer.resolvedSources[index], filename);
        else limitations.push(`${cssFile}: source map references unavailable local authoring files; their generated CSS locations are retained.`);
        if (raw.sourcesContent && typeof raw.sourcesContent[index] === 'string') {
          const content = raw.sourcesContent[index];
          // css-loader can use the SCSS entry's URL for intermediate, generated CSS.
          // Such a snapshot is not evidence that the author changed that SCSS file.
          let synthetic = false;
          if (/\.scss$/i.test(filename) && content.trim() && ast.source.input.css.includes(content.trim())) {
            try { synthetic = readLocal(base, filename).text !== content; } catch (_) { synthetic = true; }
          }
          if (synthetic) {
            syntheticSources.add(tracer.resolvedSources[index]);
            limitations.push(`${cssFile}: source map stores intermediate CSS under ${relative(base, filename)}; its authoring attribution and content freshness are unavailable.`);
          } else snapshots.push({ filename, content });
        }
      } catch (_) { limitations.push(`${cssFile}: a source map source is outside the project or uses an unsupported URL.`); }
    }
  } catch (error) {
    limitations.push(`${cssFile}: source map unavailable (${error.message}); diagnostics retain generated CSS locations.`);
    return { map: null, inputs, snapshots, original: () => null };
  }
  let reported = false;
  return {
    map: reference && reference.startsWith('data:') ? 'inline' : relative(base, mapFile), inputs, snapshots,
    original(position) {
      try {
        const original = originalPositionFor(tracer, { line: position.line, column: position.column - 1 });
        if (!original.source || original.line === null || original.column === null || syntheticSources.has(original.source) || !localSources.has(original.source)) return null;
        return { file: relative(base, localSources.get(original.source)), line: original.line, column: original.column + 1 };
      } catch (error) {
        if (!reported) limitations.push(`${cssFile}: source map lookup failed (${error.message}); generated locations retained.`);
        reported = true;
        return null;
      }
    }
  };
}

function assessFreshness(base, file, assets, mapper, limitations) {
  const css = readLocal(base, file);
  const copied = assets.copied.find(item => item.target === path.join(base, file));
  const configInputs = assets.inputs.filter(input => ['package.json', 'webpack.config.js', 'Gruntfile.js', 'validation.json'].includes(path.basename(input)));
  const inputs = [...new Set(copied ? [copied.source, ...configInputs] : [...assets.inputs, ...mapper.inputs])];
  const newer = [], changed = [], missing = [];
  const snapshots = new Map(mapper.snapshots.map(snapshot => [snapshot.filename, snapshot.content]));
  for (const input of inputs) {
    try {
      const source = readLocal(base, input);
      if (source.stat.mtimeMs > css.stat.mtimeMs) newer.push(relative(base, input));
      if (snapshots.has(input) && source.text !== snapshots.get(input)) changed.push(relative(base, input));
    } catch (_) { missing.push(relative(base, input)); }
  }
  if (copied) {
    try { if (readLocal(base, copied.source).text !== css.text) changed.push(relative(base, copied.source)); }
    catch (_) { /* Already recorded as missing input. */ }
  }
  const status = changed.length ? 'stale' : newer.length ? 'possibly-stale' : 'unknown';
  if (missing.length) limitations.push(`${file}: some freshness inputs are missing, unreadable or oversized: ${missing.join(', ')}.`);
  if (status !== 'unknown') limitations.push(`${file}: compiled CSS is ${status}; analysis describes the existing artifact, not current SCSS. No build was run.`);
  else limitations.push(`${file}: CSS freshness is not proven; available input mtimes and source-map snapshots show no detected changes.`);
  const evidence = { status, newerInputs: newer, changedInputs: [...new Set(changed)], unavailableInputs: missing };
  return { ...evidence, finding: status === 'unknown' ? null : {
    ruleId: 'PS-ASSET-002', severity: 'warning', file, message: 'Compiled CSS may not reflect current authoring sources.', evidence,
    explanation: changed.length ? 'Local input content differs from the source-map snapshot or copied CSS.' : 'An available source/configuration file is newer than this CSS; mtimes alone do not prove stale content.',
    recommendation: 'Run the existing project asset build manually and validate again; no build scripts are run by validation.'
  } };
}

module.exports = { loadSourceMap, assessFreshness };
