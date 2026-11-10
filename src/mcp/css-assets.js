'use strict';

const fs = require('node:fs');
const path = require('node:path');
const acorn = require('acorn');

const MAX_BYTES = 1024 * 1024;
const IGNORED = new Set(['node_modules', 'vendor', 'build', 'dist', 'compiled', 'coverage']);
const relative = (base, file) => path.relative(base, file).split(path.sep).join('/');

function localPath(base, value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) throw new Error('Expected a local asset path');
  const target = path.resolve(base, value);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error('Asset path escapes project root');
  // Resolve the nearest existing ancestor so missing outputs through symlinks are safe too.
  let ancestor = target;
  while (!fs.existsSync(ancestor) && ancestor !== base) ancestor = path.dirname(ancestor);
  const real = fs.realpathSync(ancestor);
  if (real !== base && !real.startsWith(base + path.sep)) throw new Error('Asset symlink escapes project root');
  return target;
}

function readLocal(base, filename, limit = MAX_BYTES) {
  const target = localPath(base, filename);
  const stat = fs.statSync(target);
  if (!stat.isFile() || stat.size > limit) throw new Error('Not a regular file or exceeds size limit');
  return { text: fs.readFileSync(target, 'utf8'), stat };
}

function walkStyles(base, roots, limitations, generated = false) {
  const files = new Set();
  let entries = 0;
  function visit(filename) {
    if (++entries > 10000 || files.size >= 500) return;
    let stat;
    try { filename = localPath(base, filename); stat = fs.lstatSync(filename); }
    catch (error) { if (error.code !== 'ENOENT') limitations.push(`Cannot inspect ${relative(base, filename)}: ${error.message}`); return; }
    if (stat.isSymbolicLink()) return;
    if (stat.isFile()) {
      if ((generated ? /\.css$/i : /\.(css|scss)$/i).test(filename)) files.add(filename);
      return;
    }
    if (!stat.isDirectory()) return;
    let children;
    try { children = fs.readdirSync(filename, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }
    catch (error) { limitations.push(`Cannot discover CSS in ${relative(base, filename)}: ${error.code}`); return; }
    for (const child of children) {
      if (entries > 10000 || files.size >= 500) break;
      if (child.name.startsWith('.') || child.isSymbolicLink() ||
          (child.isDirectory() && (generated ? ['node_modules', 'vendor'].includes(child.name) : IGNORED.has(child.name)))) continue;
      visit(path.join(filename, child.name));
    }
  }
  for (const root of roots) visit(root);
  if (entries > 10000 || files.size >= 500) limitations.push('Stylesheet discovery stopped at 10,000 entries or 500 files.');
  return [...files].sort();
}

// A deliberately small JS AST interpreter. Never require/eval project configuration.
function staticWebpack(source, base) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const bindings = new Map(), modules = new Map();
  let exported;
  for (const statement of ast.body) {
    if (statement.type === 'VariableDeclaration') for (const item of statement.declarations) {
      if (item.id.type !== 'Identifier') continue;
      bindings.set(item.id.name, item.init);
      if (item.init && item.init.type === 'CallExpression' && item.init.callee.name === 'require' && item.init.arguments.length === 1 &&
          item.init.arguments[0].type === 'Literal') modules.set(item.id.name, item.init.arguments[0].value);
    }
    if (statement.type === 'ExportDefaultDeclaration') exported = statement.declaration;
    const expression = statement.expression;
    if (expression && expression.type === 'AssignmentExpression' && expression.left.type === 'MemberExpression' &&
        expression.left.object.name === 'module' && expression.left.property.name === 'exports') exported = expression.right;
  }
  function value(node, depth = 0) {
    if (!node || depth > 30) return undefined;
    const next = item => value(item, depth + 1);
    if (node.type === 'Literal' && !node.regex) return node.value;
    if (node.type === 'Identifier') return node.name === '__dirname' ? base : next(bindings.get(node.name));
    if (node.type === 'ArrayExpression') return node.elements.map(next);
    if (node.type === 'ObjectExpression') {
      if (node.properties.some(property => property.type !== 'Property' || property.kind !== 'init' || property.method ||
          (property.computed && property.key.type !== 'Literal'))) return undefined;
      const result = Object.create(null);
      for (const property of node.properties) if (property.type === 'Property' && property.kind === 'init' && !property.method &&
          (!property.computed || property.key.type === 'Literal')) result[property.key.name || property.key.value] = next(property.value);
      return result;
    }
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
        ['path', 'node:path'].includes(modules.get(node.callee.object.name)) && ['resolve', 'join'].includes(node.callee.property.name)) {
      const args = node.arguments.map(next);
      if (args.every(item => typeof item === 'string')) return node.callee.property.name === 'resolve' ? path.resolve(base, ...args) : path.join(...args);
    }
    if (node.type === 'NewExpression' && ['mini-css-extract-plugin', 'copy-webpack-plugin'].includes(modules.get(node.callee.name))) {
      return { plugin: modules.get(node.callee.name), options: node.arguments.length ? next(node.arguments[0]) : {} };
    }
    return undefined;
  }
  return value(exported);
}

function discoverCssAssets(base) {
  const limitations = [], findings = [], outputs = [], inputs = new Set(), sourceRoots = [], copied = [];
  let build = false, configured = false;
  const addOutput = value => { const target = localPath(base, value); if (!outputs.includes(target)) outputs.push(target); return target; };
  const addInput = value => { if (value) inputs.add(localPath(base, value)); };
  const configFile = path.join(base, '.pagestudio/validation.json');
  const webpackFile = path.join(base, 'webpack.config.js');
  try {
    if (fs.existsSync(configFile)) {
      const config = JSON.parse(readLocal(base, configFile).text).css;
      if (!config || !Array.isArray(config.outputs) || !config.outputs.length ||
          (config.sourceRoots !== undefined && !Array.isArray(config.sourceRoots))) throw new Error('Expected css.outputs and optional css.sourceRoots arrays');
      build = configured = true;
      for (const output of config.outputs) addOutput(output);
      for (const root of config.sourceRoots || []) sourceRoots.push(localPath(base, root));
      addInput(configFile);
    } else if (fs.existsSync(webpackFile)) {
      build = true;
      const config = staticWebpack(readLocal(base, webpackFile).text, base);
      if (!config || Array.isArray(config) || typeof config !== 'object') throw new Error('Webpack export is not a supported static object');
      if (Object.hasOwn(config, 'output') && (!config.output || typeof config.output !== 'object')) throw new Error('Dynamic Webpack output is unsupported');
      if (Object.hasOwn(config, 'entry') && config.entry === undefined) throw new Error('Dynamic Webpack entry is unsupported');
      if (config.output && Object.hasOwn(config.output, 'path') && typeof config.output.path !== 'string') throw new Error('Dynamic Webpack output.path is unsupported');
      if (Object.hasOwn(config, 'context') && typeof config.context !== 'string') throw new Error('Dynamic Webpack context is unsupported');
      const context = config.context ? localPath(base, config.context) : base;
      const outputRoot = localPath(base, config.output && config.output.path || path.join(base, 'dist'));
      const entries = typeof config.entry === 'string' || Array.isArray(config.entry) ? { main: config.entry } : config.entry || {};
      const styleEntries = [];
      for (const [name, entry] of Object.entries(entries)) {
        const imports = entry && typeof entry === 'object' && !Array.isArray(entry) ? entry.import : entry;
        for (const input of [].concat(imports || [])) if (typeof input === 'string' && (input.startsWith('.') || path.isAbsolute(input))) {
          const filename = localPath(base, path.resolve(context, input));
          addInput(filename);
          if (/\.(scss|css)$/i.test(input)) { styleEntries.push(name); sourceRoots.push(path.dirname(filename)); }
        }
      }
      for (const plugin of config.plugins || []) {
        if (!plugin) continue;
        if (!plugin.options || typeof plugin.options !== 'object') { limitations.push('Dynamic CSS plugin options require explicit CSS outputs.'); continue; }
        if (plugin.plugin === 'mini-css-extract-plugin') {
          const pattern = Object.hasOwn(plugin.options, 'filename') ? plugin.options.filename : '[name].css';
          if (typeof pattern !== 'string') { limitations.push('Dynamic MiniCssExtractPlugin filename is unsupported.'); continue; }
          for (const name of styleEntries) {
            const output = pattern.replace(/\[name\]/g, name);
            if (!output.includes('[')) addOutput(path.resolve(outputRoot, output));
          }
          const directory = path.dirname(pattern);
          if (!styleEntries.length || pattern.replace(/\[name\]/g, '').includes('[')) {
            if (!directory.includes('[')) {
              addOutput(path.resolve(outputRoot, directory));
              limitations.push('CSS entry names or hashes could not be enumerated; existing output directory CSS is analyzed with incomplete expected-file coverage.');
            }
            else limitations.push('Dynamic CSS output directories require css.outputs in .pagestudio/validation.json.');
          }
        }
        if (plugin.plugin === 'copy-webpack-plugin') for (const item of plugin.options.patterns || []) {
          if (!item || typeof item.from !== 'string' || typeof item.to !== 'string' || item.context !== undefined ||
              item.transform !== undefined || item.filter !== undefined || item.toType !== undefined || /[*?{}\[\]]/.test(item.from + item.to)) {
            limitations.push('Dynamic/glob CopyWebpackPlugin patterns require explicit CSS outputs.'); continue;
          }
          const from = localPath(base, path.resolve(context, item.from));
          const to = localPath(base, path.resolve(outputRoot, item.to));
          if (fs.existsSync(from) && fs.statSync(from).isDirectory()) {
            for (const source of walkStyles(base, [from], limitations, true)) {
              const target = addOutput(path.join(to, path.relative(from, source)));
              copied.push({ source, target }); addInput(source);
            }
          } else if (/\.css$/i.test(from)) {
            const target = addOutput(/\.css$/i.test(to) ? to : path.join(to, path.basename(from)));
            copied.push({ source: from, target }); addInput(from);
          } else limitations.push(`Copy source ${relative(base, from)} is missing or unsupported.`);
        }
      }
      configured = outputs.length > 0;
      if (!configured) throw new Error('No static extracted/copied CSS outputs could be established');
      limitations.push('Static CSS discovery does not infer JavaScript-imported CSS or additional code-split chunks; declare extra css.outputs when needed.');
    }
  } catch (error) {
    limitations.push(`CSS build discovery is incomplete: ${error.message}. Configure .pagestudio/validation.json for unsupported builds.`);
    findings.push({ ruleId: 'PS-ASSET-003', severity: 'info', file: fs.existsSync(configFile) ? '.pagestudio/validation.json' : 'webpack.config.js',
      message: 'CSS build configuration could not be fully resolved without execution.', evidence: { reason: error.message },
      explanation: 'Validation never executes JavaScript configuration or project scripts.', recommendation: 'Declare local css.outputs and css.sourceRoots in .pagestudio/validation.json.' });
  }
  for (const file of ['package.json', 'Gruntfile.js', 'webpack.config.js']) if (fs.existsSync(path.join(base, file))) {
    try { addInput(file); } catch (error) { limitations.push(`${file}: ${error.message}`); }
  }
  const sources = walkStyles(base, [base], limitations).filter(file => /\.scss$/i.test(file) ||
    !outputs.some(output => file === output || (output !== base && file.startsWith(output + path.sep))));
  // Without a discoverable build, conventional compiled output can still be inspected.
  if (!configured && (build || sources.some(file => /\.scss$/i.test(file)))) {
    for (const directory of ['compiled/assets/css', 'dist/assets/css', 'build/assets/css']) {
      if (fs.existsSync(path.join(base, directory))) { addOutput(directory); build = true; }
    }
    if (outputs.length) limitations.push('Using conventional compiled CSS directories; exact build outputs and dependencies are not established.');
  }
  const compiled = walkStyles(base, outputs, limitations, true).sort((a, b) => {
    const rank = file => { const index = outputs.indexOf(file); return index === -1 ? outputs.length : index; };
    return rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0);
  });
  const stylesheets = build ? compiled : sources.filter(file => /\.css$/i.test(file));
  if (!build && sources.some(file => /\.scss$/i.test(file))) {
    limitations.push('SCSS source was found without discoverable compiled CSS; SCSS is checked for authoring syntax only. Configure CSS outputs or run the existing asset build manually.');
  }
  const missing = outputs.filter(output => /\.css$/i.test(output) ? !fs.existsSync(output) : !compiled.some(file => file.startsWith(output + path.sep)));
  if ((!stylesheets.length && sources.some(file => /\.scss$/i.test(file))) || missing.length) {
    const files = missing.length ? missing.map(file => relative(base, file)) : ['(undiscovered compiled CSS)'];
    limitations.push(`Missing compiled CSS: ${files.join(', ')}. Fixture compatibility coverage is incomplete; no build was run.`);
    findings.push({ ruleId: 'PS-ASSET-001', severity: 'warning', file: files[0], message: 'Expected compiled CSS is missing or unavailable.',
      evidence: { missing: files }, explanation: 'SCSS source is not a substitute for the CSS the browser receives.',
      recommendation: 'Run the project\'s existing asset build manually, then validate again. The validator will not run it.' });
  }
  for (const source of sources) if (sourceRoots.some(root => source === root || source.startsWith(root + path.sep))) inputs.add(source);
  return { mode: build ? 'compiled' : 'plain-css', stylesheets, sources, inputs: [...inputs].sort(), copied,
    expected: outputs.map(file => relative(base, file)), findings, limitations };
}

module.exports = { discoverCssAssets, readLocal, localPath, relative };
