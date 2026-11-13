'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { createBuildStatus } = require('../src/dev/build-status');
const rootDir = path.resolve(__dirname, '..');
const resources = path.join(rootDir, 'resources/agent-workflow');
const names = ['pagestudio_get_block_contract', 'pagestudio_get_build_status', 'pagestudio_validate_template'];

describe('Reusable agent workflow distribution', function () {
  it('ships guidance, configuration and an explicitly unexecuted report in the npm package', function () {
    this.timeout(10000);
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-agent-pack-'));
    try {
      const [pack] = JSON.parse(execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
        cwd: rootDir, encoding: 'utf8', env: { ...process.env, npm_config_cache: cache }, stdio: ['ignore', 'pipe', 'pipe']
      }));
      for (const file of ['AGENTS.md', 'codex.config.toml.example', 'vscode.mcp.json.example', 'verification-report.md']) {
        assert.ok(pack.files.some(item => item.path === 'resources/agent-workflow/' + file), file);
      }
      for (const file of ['bin/pagestudio.js', 'bin/pagestudio-mcp.js', 'src/commands/init.js', 'src/commands/doctor.js', 'src/commands/agent-config.js', 'docs/agent-workflow/README.md']) {
        assert.ok(pack.files.some(item => item.path === file), file);
      }
      assert.match(fs.readFileSync(path.join(resources, 'verification-report.md'), 'utf8'), /TEMPLATE \(not run evidence\)/);
    } finally { fs.rmSync(cache, { recursive: true, force: true }); }
  });
  it('keeps client examples scoped to the same template root without a contract override or build command', function () {
    const json = JSON.parse(fs.readFileSync(path.join(resources, 'vscode.mcp.json.example'), 'utf8'));
    const server = json.servers.pagestudio;
    assert.equal(server.type, 'stdio'); assert.equal(server.command, 'node');
    assert.ok(server.args[0].endsWith('/bin/pagestudio-mcp.js'));
    assert.deepEqual(server.env, { PAGESTUDIO_PROJECT_ROOT: '${workspaceFolder}' });
    const toml = fs.readFileSync(path.join(resources, 'codex.config.toml.example'), 'utf8');
    assert.match(toml, /\[mcp_servers\.pagestudio\]/);
    assert.match(toml, /\[mcp_servers\.pagestudio\.env\]/);
    assert.match(toml, /^command = "node"$/m);
    assert.match(toml, /^cwd = "\/absolute\/path\/to\/template-project"$/m);
    assert.match(toml, /^PAGESTUDIO_PROJECT_ROOT = "\/absolute\/path\/to\/template-project"$/m);
    assert.ok(!toml.includes('${workspaceFolder}'));
    assert.ok(!/^PAGESTUDIO_BLOCK_CONTRACTS_DIR\s*=/m.test(toml));
  });
  it('keeps concise guidance aligned with the protocol and separates browser/native evidence', function () {
    const guidance = fs.readFileSync(path.join(resources, 'AGENTS.md'), 'utf8');
    assert.ok(Buffer.byteLength(guidance) < 6000);
    for (const name of names) assert.ok(guidance.includes(name));
    for (const requirement of [/before editing/, /ALL affected/, /sessionId/, /generation/, /entire validation batch/, /unavailable.*NOT success/, /browser appearance/, /native-agent discovery unverified/]) {
      assert.match(guidance, requirement);
    }
    assert.ok(!guidance.includes('src/html/layouts')); assert.ok(!guidance.includes('compiled/assets/css'));
  });
});

describe('Documented agent protocol over MCP', function () {
  this.timeout(10000);
  let root, client, owner;
  beforeEach(async function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-agent-protocol-'));
    fs.mkdirSync(path.join(root, '.pagestudio'));
    fs.cpSync(path.join(__dirname, 'fixtures/cms-contracts'), path.join(root, '.pagestudio/contracts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'pages')); fs.mkdirSync(path.join(root, 'styles'));
    fs.writeFileSync(path.join(root, 'styles/theme.css'), '.btn { color: red }');
    for (const name of ['one', 'two']) fs.writeFileSync(path.join(root, 'pages', name + '.html'), '<main>Fixture ' + name + '</main>');
    client = new Client({ name: 'documented-agent-protocol-test', version: '1.0.0' });
    await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(rootDir, 'bin/pagestudio-mcp.js')],
      env: { ...process.env, PAGESTUDIO_PROJECT_ROOT: root, PAGESTUDIO_BLOCK_CONTRACTS_DIR: path.join(root, '.pagestudio/contracts') }, stderr: 'pipe' }));
  });
  afterEach(async function () { if (client) await client.close(); if (owner) owner.close(); owner = null; fs.rmSync(root, { recursive: true, force: true }); });
  const call = async (name, args = {}) => {
    const result = await client.callTool({ name, arguments: args }); assert.ok(!result.isError, result.content[0].text);
    assert.deepEqual(result.structuredContent, JSON.parse(result.content[0].text)); return result.structuredContent;
  };
  // Test the documented acceptance rule against real wire results, not a new runtime orchestrator.
  const stable = (before, after) => Boolean(before.available && before.ready && after.available && after.ready &&
    before.projectRoot === after.projectRoot && before.sessionId === after.sessionId && before.generation === after.generation);
  function ready(generation) {
    owner.update({ state: 'ready', phase: null, generation, activeGeneration: null, pendingChanges: { count: 0, files: [] },
      lastSuccessfulBuild: { generation, completedAt: new Date().toISOString() }, preview: { state: 'listening', port: 3000 } });
  }
  it('discovers the documented tools and retrieves contracts before template verification', async function () {
    const listed = await client.listTools(); for (const name of names) assert.ok(listed.tools.some(item => item.name === name));
    assert.equal((await call('pagestudio_get_block_contract', { name: 'button' })).renderer, 'cms-built-in');
    assert.equal((await call('pagestudio_get_build_status')).ready, false);
  });
  it('discards a changed generation and revalidates the entire batch at a stable generation', async function () {
    owner = createBuildStatus(root); ready(1);
    const before = await call('pagestudio_get_build_status');
    assert.equal((await call('pagestudio_validate_template', { file: 'pages/one.html' })).valid, true);
    owner.update({ state: 'building', generation: 2, activeGeneration: 2, pendingChanges: { count: 1, files: ['styles/theme.css'] } });
    const during = await call('pagestudio_get_build_status'); assert.equal(stable(before, during), false);
    ready(2); assert.equal(stable(before, await call('pagestudio_get_build_status')), false);
    const retryBefore = await call('pagestudio_get_build_status');
    const results = [];
    for (const file of ['pages/one.html', 'pages/two.html']) results.push(await call('pagestudio_validate_template', { file }));
    const retryAfter = await call('pagestudio_get_build_status');
    assert.ok(results.every(result => result.valid)); assert.equal(stable(retryBefore, retryAfter), true);
    owner.close(); owner = createBuildStatus(root); ready(2);
    assert.equal(stable(retryAfter, await call('pagestudio_get_build_status')), false, 'A restarted session invalidates even the same generation');
  });
  it('does not accept missing contracts, failed status, validation errors or unavailable status as success', async function () {
    const missing = await client.callTool({ name: 'pagestudio_get_block_contract', arguments: { name: 'missing' } }); assert.equal(missing.isError, true);
    owner = createBuildStatus(root); ready(1); const before = await call('pagestudio_get_build_status');
    owner.update({ state: 'failed', failure: { phase: 'assets', code: 1 } }); assert.equal(stable(before, await call('pagestudio_get_build_status')), false);
    owner.update({ failure: null }); ready(2); fs.writeFileSync(path.join(root, 'pages/one.html'), '{{ if active }}');
    assert.equal((await call('pagestudio_validate_template', { file: 'pages/one.html' })).valid, false);
    owner.close(); assert.equal(stable(before, await call('pagestudio_get_build_status')), false);
  });
});
