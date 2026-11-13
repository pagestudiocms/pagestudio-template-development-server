#!/usr/bin/env node
'use strict';

// Explicit, disposable adoption exercise. Not called by init/doctor or MCP.
// Requires an existing verified CMS export; never fabricates contract data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { getBuildStatus } = require('../src/dev/build-status');
const packageRoot = path.resolve(__dirname, '..');
const cli = path.join(packageRoot, 'bin/pagestudio.js');
const quote = value => '"' + value.replace(/(["\\$`])/g, '\\$1') + '"';
const write = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
async function until(predicate) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const value = predicate(); if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error('Timed out waiting for adoption dev owner');
}

async function exercise(source, output) {
  if (!source || !output) throw new Error('Usage: node scripts/verify-agent-kit-adoption.js /absolute/verified-cms-export /absolute/evidence.json');
  if (process.platform === 'win32') throw new Error('This disposable exercise is POSIX-only; Windows adoption is unverified.');
  const exportRoot = fs.realpathSync(source);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pagestudio second template '));
  const env = { ...process.env, PAGESTUDIO_PROJECT_ROOT: root, PAGESTUDIO_BLOCK_CONTRACTS_DIR: '' };
  const command = args => execFileSync(process.execPath, [cli, ...args], { cwd: root, env, encoding: 'utf8' });
  let child, client, closed, logs = '';
  const evidence = { date: new Date().toISOString(), repository: 'independent disposable non-Gourmet template Git repository',
    platform: process.platform, node: process.version, transport: 'diagnostic SDK stdio (not native Codex)',
    nativeCodexVSCode: 'NOT_VERIFIED: exercise has no native VS Code session', browserAppearance: 'NOT_CHECKED',
    exportManifestSha256: require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(exportRoot, 'manifest.json'))).digest('hex') };
  try {
    // Configure this new template before starting its one owner. No existing theme
    // scripts or working files are touched, and the source paths differ from Gourmet.
    write(root, 'package.json', JSON.stringify({ name: 'pagestudio-second-template-adoption', private: true,
      scripts: { start: `${quote(process.execPath)} ${quote(cli)} dev --open false --port 0`, 'build-assets': 'node build-assets.cjs' } }, null, 2));
    write(root, 'site.config.json', JSON.stringify({ src: 'views', layouts: 'views/pages', partials: 'views/includes', 'data-src': 'content', out: 'public',
      dev: { assetScript: 'build-assets', assetWatch: ['theme'], debounceMs: 50 } }, null, 2));
    write(root, '.pagestudio/validation.json', JSON.stringify({ css: { outputs: ['public/theme.css'], sourceRoots: ['theme'] } }));
    write(root, '.gitignore', 'public/\n.pagestudio/contracts/\n.pagestudio/build-status.json\n.pagestudio/dev.lock\n.codex/config.toml\n');
    write(root, 'build-assets.cjs', `const fs=require('node:fs'),sass=require(${JSON.stringify(require.resolve('sass'))});\nconst result=sass.compile('theme/main.scss',{sourceMap:true,sourceMapIncludeSources:true});\nfs.mkdirSync('public',{recursive:true});fs.writeFileSync('public/theme.css',result.css+'\\n/*# sourceMappingURL=theme.css.map */');fs.writeFileSync('public/theme.css.map',JSON.stringify(result.sourceMap));\n`);
    write(root, 'theme/main.scss', '$radius: .25rem;\n.btn { border-radius: $radius; }\n');
    write(root, 'views/includes/banner.html', '<header>Template adoption</header>');
    const button = fs.readFileSync(path.join(exportRoot, 'block-button.html'), 'utf8');
    for (const name of ['index', 'contact']) {
      write(root, `views/pages/${name}.html`, '<!doctype html><html><head><link rel="stylesheet" href="/theme.css"></head><body>{{ template:partial name="banner" }}<main>' + button + '</main></body></html>');
      write(root, `content/${name}.data.json`, '{}');
    }
    execFileSync('git', ['init', '--quiet'], { cwd: root });
    execFileSync('git', ['add', '.'], { cwd: root });
    execFileSync('git', ['-c', 'user.name=PageStudio adoption exercise', '-c', 'user.email=adoption@example.invalid', 'commit', '--quiet', '-m', 'Initial independent template fixture'], { cwd: root });
    assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }), '');
    evidence.initialRepositoryClean = true;
    // Setup starts exactly one owner BEFORE init; all commands below reuse it.
    child = spawn('npm', ['run', 'start'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
    closed = new Promise(resolve => child.once('close', resolve));
    child.stdout.on('data', data => { logs = (logs + data).slice(-20000); });
    child.stderr.on('data', data => { logs = (logs + data).slice(-20000); });
    const initial = await until(() => { const status = getBuildStatus(root); return status.ready && status; });
    evidence.initialOwner = initial;
    evidence.preview = command(['init', '--agent', 'codex', '--dry-run']);
    assert.ok(!fs.existsSync(path.join(root, 'AGENTS.md')));
    evidence.init = command(['init', '--agent', 'codex']);
    evidence.idempotent = /UNCHANGED AGENTS.md/.test(command(['init', '--agent', 'codex']));
    evidence.contractSync = command(['contracts', 'sync', '--from', exportRoot]);
    evidence.doctor = JSON.parse(command(['doctor', '--json']));
    assert.equal(evidence.doctor.exitCode, 0);
    client = new Client({ name: 'second-template-adoption-diagnostic', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(packageRoot, 'bin/pagestudio-mcp.js')], cwd: root, env, stderr: 'pipe' }));
    evidence.tools = (await client.listTools()).tools.map(tool => tool.name);
    const call = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      assert.ok(!result.isError, JSON.stringify(result));
      return result.structuredContent || JSON.parse(result.content[0].text);
    };
    evidence.contract = await call('pagestudio_get_block_contract', { name: 'button' });
    // Bounded shared style + partial changes affect both layouts.
    write(root, 'theme/main.scss', '$radius: .375rem;\n.btn { border-radius: $radius; }\n');
    write(root, 'views/includes/banner.html', '<header>Template adoption verified over diagnostic MCP</header>');
    await until(() => { const status = getBuildStatus(root); return status.ready && status.generation > initial.generation; });
    evidence.before = await call('pagestudio_get_build_status');
    evidence.validation = [];
    for (const file of ['views/pages/index.html', 'views/pages/contact.html']) {
      assert.match(fs.readFileSync(path.join(root, 'public', path.basename(file)), 'utf8'), /adoption verified/);
      const result = await call('pagestudio_validate_template', { file });
      assert.equal(result.valid, true, JSON.stringify(result.findings));
      evidence.validation.push({ file, result });
    }
    evidence.after = await call('pagestudio_get_build_status');
    assert.ok(evidence.before.ready && evidence.after.ready);
    assert.equal(evidence.before.projectRoot, root); assert.equal(evidence.before.sessionId, initial.sessionId);
    assert.equal(evidence.before.sessionId, evidence.after.sessionId); assert.equal(evidence.before.generation, evidence.after.generation);
    evidence.batchAccepted = true;
  } finally {
    if (client) await client.close();
    if (child) {
      const status = getBuildStatus(root);
      if (status.available) process.kill(status.pid, 'SIGTERM'); else child.kill('SIGTERM');
      let timer;
      try { await Promise.race([closed, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Owner did not stop')), 6000); })]); }
      finally { clearTimeout(timer); }
      evidence.ownerAfterStop = getBuildStatus(root);
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
  // Keep machine paths out of the review artifact while retaining session/generation.
  const sanitize = value => JSON.stringify(value, null, 2).split(root).join('<template-root>').split(packageRoot).join('<development-server>').split(exportRoot).join('<verified-cms-export>').split(process.execPath).join('<node>');
  fs.writeFileSync(path.resolve(output), sanitize(evidence) + '\n');
  console.log(`Adoption batch accepted at generation ${evidence.before.generation}; native VS Code invocation NOT_VERIFIED. Evidence: ${path.resolve(output)}`);
}

if (require.main === module) exercise(process.argv[2], process.argv[3]).catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { exercise };
