'use strict';
const fs = require('node:fs');
const path = require('node:path');
function resolveDevConfig(options = {}, root = process.cwd()) {
  const configFile = path.resolve(root, options.config || 'site.config.json');
  const config = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
  if (options.config && !fs.existsSync(configFile)) throw new Error('Specified dev config does not exist');
  const dev = config.dev || {}, src = options.src ?? config.src ?? 'src/html';
  const result = { root, configFile, src, out: options.out ?? config.out ?? 'compiled',
    layouts: options.layouts ?? config.layouts ?? path.join(src, 'layouts'),
    partials: options.partials ?? config.partials ?? path.join(src, 'partials'),
    dataSrc: options.dataSrc ?? config['data-src'] ?? path.join(src, 'data'),
    port: Number(options.port ?? config.port ?? 3000), host: options.host ?? config.host ?? '127.0.0.1',
    open: String(options.open ?? config.open ?? true), debounceMs: Number(options.debounce ?? dev.debounceMs ?? 100) };
  if (!Number.isInteger(result.port) || result.port < 0 || result.port > 65535 || !Number.isFinite(result.debounceMs) || result.debounceMs < 10 || result.debounceMs > 5000) throw new Error('Invalid dev port or debounce');
  for (const key of ['src', 'out', 'layouts', 'partials', 'dataSrc']) {
    if (typeof result[key] !== 'string' || !result[key].trim()) throw new Error(`Invalid dev ${key}`);
    result[key] = path.resolve(root, result[key]);
  }
  const pkgFile = path.join(root, 'package.json');
  const pkg = fs.existsSync(pkgFile) ? JSON.parse(fs.readFileSync(pkgFile, 'utf8')) : {};
  const scripts = pkg.scripts || {}, explicit = options.assetScript ?? dev.assetScript;
  const script = explicit ?? ['build-assets', 'grunt:build'].find(name => typeof scripts[name] === 'string');
  if (script === false || script === 'none') result.assetBuild = null;
  else if (script) {
    if (typeof script !== 'string' || !Object.hasOwn(scripts, script) || typeof scripts[script] !== 'string' || !/^[a-zA-Z0-9_][a-zA-Z0-9_.:-]*$/.test(script)) throw new Error('Configured asset script does not exist or its name is unsupported');
    result.assetBuild = { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', script], label: `npm:${script}` };
  } else if (fs.existsSync(path.join(root, 'Gruntfile.js')) && fs.existsSync(path.join(root, 'webpack.config.js'))) {
    result.assetBuild = { command: process.platform === 'win32' ? 'npx.cmd' : 'npx', args: ['--no-install', 'grunt', 'webpack'], label: 'grunt:webpack' };
  } else result.assetBuild = null;
  const configuredWatch = options.assetWatch ?? dev.assetWatch;
  const watch = typeof configuredWatch === 'string' ? configuredWatch.split(',') : configuredWatch;
  if (watch !== undefined && (!Array.isArray(watch) || watch.some(item => typeof item !== 'string' || !item.trim() || /[*?{}]/.test(item)))) throw new Error('assetWatch must contain literal paths, not globs');
  const sourceParent = path.dirname(result.src);
  result.assetWatch = (watch || [path.join(sourceParent, 'scss'), path.join(sourceParent, 'js'), path.join(sourceParent, 'css')]).map(item => path.resolve(root, item));
  result.htmlWatch = [result.layouts, result.partials, result.dataSrc, path.join(root, 'src/plugins'), path.join(root, 'src/template.conf')];
  result.buildWatch = ['package.json', 'Gruntfile.js', 'webpack.config.js'].map(file => path.join(root, file)); result.buildWatch.push(configFile);
  for (const input of [...result.assetWatch, ...result.htmlWatch]) if (input === result.out || input.startsWith(result.out + path.sep)) throw new Error('Watch inputs must not be inside the output directory');
  return result;
}
module.exports = { resolveDevConfig };
