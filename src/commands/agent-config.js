'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const packageRoot = path.resolve(__dirname, '../..');
const tools = ['pagestudio_get_block_contract', 'pagestudio_get_build_status', 'pagestudio_validate_template'];

function projectRoot(explicit, cwd = process.cwd()) {
  let root = fs.realpathSync(path.resolve(cwd, explicit || process.env.PAGESTUDIO_PROJECT_ROOT || '.'));
  if (!fs.statSync(root).isDirectory()) throw new Error('Project root must be a directory');
  if (explicit || process.env.PAGESTUDIO_PROJECT_ROOT) return root;
  const fallback = root;
  while (true) {
    if (fs.existsSync(path.join(root, 'package.json')) || fs.existsSync(path.join(root, '.git'))) return root;
    const parent = path.dirname(root);
    if (parent === root) return fallback;
    root = parent;
  }
}

// Never follow project configuration/guidance symlinks when reading or writing.
function readLocal(root, relative) {
  const parts = relative.split('/');
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw new Error(`Refusing symlink: ${current}. Use a regular project-local file/directory.`);
      if (current !== path.join(root, ...parts) && !stat.isDirectory()) throw new Error(`Expected directory: ${current}`);
      if (current === path.join(root, ...parts) && !stat.isFile()) throw new Error(`Expected regular file: ${current}`);
    } catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
  }
  return fs.readFileSync(current, 'utf8');
}

function parseConfig(text) {
  try { return require('@iarna/toml').parse(text); }
  catch (error) { throw new Error(`Cannot read Codex TOML: ${error.message}. Repair .codex/config.toml, then rerun init --agent codex --dry-run.`); }
}

function expectedServer(root) {
  return { command: process.execPath, args: [path.join(packageRoot, 'bin/pagestudio-mcp.js')], cwd: root,
    env: { PAGESTUDIO_PROJECT_ROOT: root } };
}

function executable(command) {
  if (typeof command !== 'string' || !command) throw new Error('Missing MCP command');
  const candidates = path.isAbsolute(command) ? [command] : (process.env.PATH || '').split(path.delimiter).map(dir => path.join(dir, command));
  for (const candidate of candidates) {
    try { fs.accessSync(candidate, fs.constants.X_OK); if (fs.statSync(candidate).isFile()) return fs.realpathSync(candidate); } catch (_) { /* Continue PATH search. */ }
  }
  throw new Error(`MCP executable ${command} is unavailable. Restore Node/package installation and rerun init.`);
}

function checkServer(server, root, { partial = false } = {}) {
  const expected = expectedServer(root);
  if (!server || typeof server !== 'object' || Array.isArray(server)) throw new Error('Missing [mcp_servers.pagestudio]; run pagestudio init --agent codex');
  for (const key of ['command', 'args', 'cwd']) {
    if (partial && server[key] === undefined) continue;
    const matches = key === 'command' ? executable(server.command) === fs.realpathSync(process.execPath)
      : isDeepStrictEqual(server[key], expected[key]);
    if (!matches) throw new Error(`Conflicting mcp_servers.pagestudio.${key}. Review it manually; expected ${JSON.stringify(expected[key])}. Existing settings were preserved.`);
  }
  if (server.url !== undefined || server.enabled === false) throw new Error('PageStudio must be an enabled stdio server; review url/enabled in .codex/config.toml');
  if (server.env !== undefined && (!server.env || typeof server.env !== 'object' || Array.isArray(server.env) || Object.values(server.env).some(value => typeof value !== 'string'))) throw new Error('PageStudio env must be a table of strings');
  if (!(partial && server.env?.PAGESTUDIO_PROJECT_ROOT === undefined) && server.env?.PAGESTUDIO_PROJECT_ROOT !== root) throw new Error(`Conflicting PAGESTUDIO_PROJECT_ROOT; expected ${JSON.stringify(root)}. Review .codex/config.toml manually.`);
  for (const name of tools) {
    if ((server.enabled_tools !== undefined && (!Array.isArray(server.enabled_tools) || !server.enabled_tools.includes(name))) ||
        (server.disabled_tools !== undefined && (!Array.isArray(server.disabled_tools) || server.disabled_tools.includes(name)))) throw new Error(`Codex tool filters disable ${name}; review enabled_tools/disabled_tools manually.`);
  }
  for (const key of ['startup_timeout_sec', 'tool_timeout_sec']) {
    if (server[key] !== undefined && (typeof server[key] !== 'number' || !Number.isFinite(server[key]) || server[key] <= 0)) throw new Error(`Invalid PageStudio ${key}; use a positive number`);
  }
  return expected;
}

module.exports = { packageRoot, tools, projectRoot, readLocal, parseConfig, expectedServer, checkServer, executable };
