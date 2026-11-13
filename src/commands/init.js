'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { isDeepStrictEqual } = require('node:util');
const { packageRoot, projectRoot, readLocal, parseConfig, expectedServer, checkServer } = require('./agent-config');
const START = '<!-- pagestudio:agent-workflow:start -->';
const END = '<!-- pagestudio:agent-workflow:end -->';

function guidance(text) {
  const shared = fs.readFileSync(path.join(packageRoot, 'resources/agent-workflow/AGENTS.md'), 'utf8').trimEnd();
  const block = `${START}\n${shared}\n${END}`;
  const starts = text.split(START).length - 1, ends = text.split(END).length - 1;
  if (starts || ends) {
    if (starts !== 1 || ends !== 1 || text.indexOf(END) < text.indexOf(START)) throw new Error('Malformed PageStudio markers in AGENTS.md. Repair the marked block manually; no files changed.');
    if (text.slice(text.indexOf(START), text.indexOf(END) + END.length).replace(/\r\n/g, '\n') !== block) throw new Error('The managed PageStudio guidance was edited or is from another version. Review it against resources/agent-workflow/AGENTS.md and reconcile the marked block manually; no files changed.');
    return text;
  }
  return text + (text ? (text.endsWith('\n') ? '\n' : '\n\n') : '') + block + '\n';
}

function mergeConfig(text, root) {
  const before = parseConfig(text), expected = expectedServer(root);
  if (before.mcp_servers !== undefined && (!before.mcp_servers || typeof before.mcp_servers !== 'object' || Array.isArray(before.mcp_servers))) throw new Error('mcp_servers must be a TOML table. Repair .codex/config.toml manually; no files changed.');
  const existing = before.mcp_servers?.pagestudio;
  const quote = value => JSON.stringify(value).replace(/[\u007f]/g, '\\u007f');
  let candidate = text;
  const append = source => { candidate += (candidate.endsWith('\n') || !candidate ? '\n' : '\n\n') + source + '\n'; };
  if (existing === undefined) {
    append(`[mcp_servers.pagestudio]\ncommand = ${quote(expected.command)}\nargs = [${quote(expected.args[0])}]\ncwd = ${quote(root)}\nstartup_timeout_sec = 20\ntool_timeout_sec = 120\n\n[mcp_servers.pagestudio.env]\nPAGESTUDIO_PROJECT_ROOT = ${quote(root)}`);
  } else {
    checkServer(existing, root, { partial: true });
    // Only insert into simple explicit tables. Parse and compare the complete
    // result below so headers inside multiline strings cannot corrupt settings.
    function insert(header, assignments) {
      if (!assignments.length) return;
      const pattern = new RegExp(`^\\[${header.replaceAll('.', '\\.')}\\][ \\t]*(?:#[^\\r\\n]*)?(\\r?\\n|$)`, 'm');
      if (!pattern.test(candidate)) throw new Error(`Cannot safely extend ${header}. Use an explicit [${header}] table and rerun --dry-run, or merge resources/agent-workflow/codex.config.toml.example manually. No files changed.`);
      candidate = candidate.replace(pattern, match => match + (match.endsWith('\n') ? '' : '\n') + assignments.join('\n') + '\n');
    }
    insert('mcp_servers.pagestudio', ['command', 'args', 'cwd'].filter(key => existing[key] === undefined).map(key => `${key} = ${quote(expected[key])}`));
    if (existing.env === undefined) append(`[mcp_servers.pagestudio.env]\nPAGESTUDIO_PROJECT_ROOT = ${quote(root)}`);
    else if (existing.env.PAGESTUDIO_PROJECT_ROOT === undefined) insert('mcp_servers.pagestudio.env', [`PAGESTUDIO_PROJECT_ROOT = ${quote(root)}`]);
  }
  let after;
  try { after = parseConfig(candidate); }
  catch (_) { throw new Error('Cannot safely extend this TOML representation. Merge resources/agent-workflow/codex.config.toml.example manually; no files changed.'); }
  const desired = structuredClone(before);
  desired.mcp_servers ??= {};
  desired.mcp_servers.pagestudio ??= { startup_timeout_sec: 20, tool_timeout_sec: 120 };
  const server = desired.mcp_servers.pagestudio;
  for (const key of ['command', 'args', 'cwd']) server[key] ??= expected[key];
  server.env ??= {}; server.env.PAGESTUDIO_PROJECT_ROOT ??= root;
  if (!isDeepStrictEqual(after, desired)) throw new Error('Cannot safely merge this TOML representation. Merge the shipped example manually; no files changed.');
  checkServer(after.mcp_servers.pagestudio, root);
  return candidate;
}

function initialize(options = {}) {
  if (options.agent !== 'codex') throw new Error('Use pagestudio init --agent codex (Codex VS Code extension; CLI not required)');
  const root = projectRoot(options.projectRoot);
  const originals = new Map(['AGENTS.md', '.codex/config.toml'].map(file => [file, readLocal(root, file)]));
  // Plan both changes before touching any file, including on merge conflicts.
  const planned = new Map([['AGENTS.md', guidance(originals.get('AGENTS.md'))], ['.codex/config.toml', mergeConfig(originals.get('.codex/config.toml'), root)]]);
  const changes = [...planned].map(([file, content]) => ({ file, action: content === originals.get(file) ? 'unchanged' : fs.existsSync(path.join(root, file)) ? 'update' : 'create', content }));
  if (!options.dryRun) {
    const stages = [];
    try {
      // Prepare both complete files before replacing either original. A write or
      // permission failure cannot truncate existing project guidance/config.
      for (const { file, content, action } of changes) {
        if (action === 'unchanged') continue;
        const target = path.join(root, file);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        readLocal(root, file);
        const temporary = path.join(path.dirname(target), `.pagestudio-init-${randomUUID()}.tmp`);
        stages.push({ file, target, temporary, action });
        const mode = action === 'update' ? fs.statSync(target).mode & 0o777 : 0o600;
        fs.writeFileSync(temporary, content, { flag: 'wx', mode });
      }
      for (const { file, action } of changes) {
        if (readLocal(root, file) !== originals.get(file) || (action === 'create' && fs.existsSync(path.join(root, file)))) throw new Error(`${file} changed during initialization; rerun --dry-run`);
      }
      for (const { target, temporary, action } of stages) {
        if (action === 'create') fs.linkSync(temporary, target); // Exclusive create.
        else fs.renameSync(temporary, target);
      }
    } finally {
      for (const { temporary } of stages) if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
  }
  return { projectRoot: root, dryRun: Boolean(options.dryRun), changes };
}

function run(options) {
  const result = initialize(options);
  console.log(`${result.dryRun ? 'Preview' : 'Initialized'} Codex project: ${result.projectRoot}`);
  for (const change of result.changes) {
    console.log(`${change.action.toUpperCase()} ${change.file}`);
    if (result.dryRun && change.action !== 'unchanged') console.log(change.content);
  }
  console.log('Local Codex config uses absolute Node/package/project paths; rerun init after moving/reinstalling and review conflicts. Keep it local; use the shipped example for tracking.');
  console.log('Run pagestudio contracts sync --from "/absolute/path/to/verified-cms-export", then pagestudio doctor. Reuse the project dev owner, or start the existing npm run start once.');
  console.log('Reload the VS Code window and start a new Codex session in this project. Project config requires developer-managed trust. Invoke pagestudio_get_build_status from the native Codex tools, then retrieve a block contract and validate an affected layout. Doctor cannot verify native invocation or visual appearance.');
  return result;
}

module.exports = { initialize, mergeConfig, run };
