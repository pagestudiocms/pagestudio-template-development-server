'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { initialize, mergeConfig } = require('../src/commands/init');
const { diagnose } = require('../src/commands/doctor');
const { projectRoot, parseConfig, expectedServer } = require('../src/commands/agent-config');
const { createBuildStatus } = require('../src/dev/build-status');
const { syncContracts } = require('../src/commands/contracts');
const cli = path.resolve(__dirname, '../bin/pagestudio.js');
const write = (root, file, text) => { fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); fs.writeFileSync(path.join(root, file), text); };
const check = (result, prefix) => result.checks.find(item => item.name.startsWith(prefix));

describe('Codex template kit initialization', function () {
  let root;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps kit space-')); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
  const init = options => initialize({ agent: 'codex', projectRoot: root, ...options });

  it('initializes an empty directory with absolute executable/root and shipped shared guidance', () => {
    const result = init();
    assert.deepEqual(result.changes.map(item => item.action), ['create', 'create']);
    assert.deepEqual(parseConfig(fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8')).mcp_servers.pagestudio,
      { ...expectedServer(root), startup_timeout_sec: 20, tool_timeout_sec: 120 });
    assert.ok(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').includes(fs.readFileSync(path.resolve(__dirname, '../resources/agent-workflow/AGENTS.md'), 'utf8').trimEnd()));
    assert.deepEqual(fs.readdirSync(root).sort(), ['.codex', 'AGENTS.md']);
  });
  it('preserves user text, comments, other servers and settings byte for byte', () => {
    const agents = '# Local rules\r\nDo not edit vendor files.\r\n';
    const config = '# Personal settings\r\nmodel = "custom"\r\n[mcp_servers.other]\r\ncommand = "another"\r\n';
    write(root, 'AGENTS.md', agents); write(root, '.codex/config.toml', config);
    init();
    assert.ok(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8').startsWith(agents));
    assert.ok(fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8').startsWith(config));
    const first = ['AGENTS.md', '.codex/config.toml'].map(file => fs.readFileSync(path.join(root, file)));
    assert.ok(init().changes.every(item => item.action === 'unchanged'));
    for (const [i, file] of ['AGENTS.md', '.codex/config.toml'].entries()) assert.deepEqual(fs.readFileSync(path.join(root, file)), first[i]);
  });
  it('merges missing fields in explicit PageStudio tables without discarding custom settings', () => {
    const config = '# Keep this\n[mcp_servers.pagestudio] # local\ntool_timeout_sec = 90\n[mcp_servers.pagestudio.env]\nCUSTOM_FLAG = "keep"\n';
    write(root, '.codex/config.toml', config); init();
    const text = fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8');
    assert.ok(text.includes('# Keep this')); assert.ok(text.includes('# local')); assert.ok(text.includes('CUSTOM_FLAG = "keep"'));
    const server = parseConfig(text).mcp_servers.pagestudio;
    assert.equal(server.tool_timeout_sec, 90); assert.equal(server.env.CUSTOM_FLAG, 'keep');
    assert.ok(init().changes.every(item => item.action === 'unchanged'));
  });
  it('retains an equivalent Node-on-PATH configuration and existing file permissions', () => {
    init();
    const file = path.join(root, '.codex/config.toml');
    const text = fs.readFileSync(file, 'utf8').replace(JSON.stringify(process.execPath), '"node"');
    fs.writeFileSync(file, text); fs.chmodSync(file, 0o640);
    assert.ok(init().changes.every(item => item.action === 'unchanged'));
    assert.equal(fs.readFileSync(file, 'utf8'), text); assert.equal(fs.statSync(file).mode & 0o777, 0o640);
    assert.ok(!fs.readdirSync(root).some(name => name.endsWith('.tmp')));
  });
  it('previews exact content without creating directories or touching existing files', () => {
    const result = init({ dryRun: true }); assert.equal(result.dryRun, true);
    assert.ok(result.changes[1].content.includes(root)); assert.deepEqual(fs.readdirSync(root), []);
    write(root, 'AGENTS.md', 'Project rule'); init({ dryRun: true });
    assert.deepEqual(fs.readdirSync(root), ['AGENTS.md']); assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), 'Project rule');
  });
  for (const agentsExist of [false, true]) for (const configExists of [false, true]) {
    it(`rolls back the first ${agentsExist ? 'update' : 'creation'} if the second ${configExists ? 'replacement' : 'creation'} fails`, () => {
      const agents = Buffer.from('# Local rules\r\nKeep project instructions.\r\n');
      const config = Buffer.from('# Existing config\r\n[mcp_servers.other]\r\ncommand = "keep"\r\n');
      const agentsFile = path.join(root, 'AGENTS.md'), configFile = path.join(root, '.codex/config.toml');
      if (agentsExist) { write(root, 'AGENTS.md', agents); fs.chmodSync(agentsFile, 0o640); }
      if (configExists) { write(root, '.codex/config.toml', config); fs.chmodSync(configFile, 0o604); }
      const injected = Object.assign(new Error('Injected second replacement failure'), { code: 'EIO' });
      const originalRename = fs.renameSync, originalLink = fs.linkSync;
      let failed = false;
      const maybeFail = (operation, source, destination, ...args) => {
        if (source.endsWith('.tmp') && destination === configFile) {
          assert.match(fs.readFileSync(agentsFile, 'utf8'), /pagestudio:agent-workflow:start/, 'The first operation must already have modified AGENTS.md');
          failed = true; throw injected;
        }
        return operation(source, destination, ...args);
      };
      fs.renameSync = (...args) => maybeFail(originalRename, ...args);
      fs.linkSync = (...args) => maybeFail(originalLink, ...args);
      const previousUmask = process.umask(0o077);
      try { assert.throws(() => init(), error => error === injected); }
      finally { fs.renameSync = originalRename; fs.linkSync = originalLink; process.umask(previousUmask); }
      assert.equal(failed, true);
      for (const [file, existed, contents, mode] of [[agentsFile, agentsExist, agents, 0o640], [configFile, configExists, config, 0o604]]) {
        assert.equal(fs.existsSync(file), existed);
        if (existed) { assert.deepEqual(fs.readFileSync(file), contents); assert.equal(fs.statSync(file).mode & 0o777, mode); }
      }
      assert.ok(!fs.readdirSync(root, { recursive: true }).some(file => file.includes('.pagestudio-init-')), 'No temporary files or backups remain');
      assert.equal(fs.existsSync(path.join(root, '.codex')), configExists, 'Remove only the empty directory created by this failed attempt');
      const beforePreview = fs.readdirSync(root, { recursive: true });
      assert.equal(init({ dryRun: true }).dryRun, true);
      assert.deepEqual(fs.readdirSync(root, { recursive: true }), beforePreview);
      init();
      assert.ok(init().changes.every(item => item.action === 'unchanged'), 'Retry succeeds and remains idempotent');
    });
  }
  it('preserves updated file permissions on success despite a restrictive umask', () => {
    write(root, 'AGENTS.md', 'Local guidance'); write(root, '.codex/config.toml', '# Local settings\n');
    fs.chmodSync(path.join(root, 'AGENTS.md'), 0o640); fs.chmodSync(path.join(root, '.codex/config.toml'), 0o604);
    const previousUmask = process.umask(0o077);
    try { init(); } finally { process.umask(previousUmask); }
    assert.equal(fs.statSync(path.join(root, 'AGENTS.md')).mode & 0o777, 0o640);
    assert.equal(fs.statSync(path.join(root, '.codex/config.toml')).mode & 0o777, 0o604);
    assert.ok(!fs.readdirSync(root, { recursive: true }).some(file => file.includes('.pagestudio-init-')));
  });
  it('cleans up staging and backups without touching originals if preparing the second file fails', () => {
    write(root, 'AGENTS.md', 'Keep local'); write(root, '.codex/config.toml', '# Keep config\n');
    const originalWrite = fs.writeFileSync;
    fs.writeFileSync = (file, ...args) => {
      if (path.dirname(file) === path.join(root, '.codex') && file.endsWith('.tmp')) throw new Error('Injected second staging failure');
      return originalWrite(file, ...args);
    };
    try { assert.throws(() => init(), /second staging failure/); } finally { fs.writeFileSync = originalWrite; }
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), 'Keep local');
    assert.equal(fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8'), '# Keep config\n');
    assert.ok(!fs.readdirSync(root, { recursive: true }).some(file => file.includes('.pagestudio-init-')));
  });
  it('retains the original backup with recovery instructions if rollback itself is refused', () => {
    const agentsFile = path.join(root, 'AGENTS.md'), configFile = path.join(root, '.codex/config.toml');
    write(root, 'AGENTS.md', 'Recover these instructions'); fs.chmodSync(agentsFile, 0o640);
    write(root, '.codex/config.toml', '# Preserve config\n');
    const originalRename = fs.renameSync;
    fs.renameSync = (source, destination, ...args) => {
      if ((source.endsWith('.tmp') && destination === configFile) || (source.endsWith('.bak') && destination === agentsFile)) throw new Error('Injected filesystem refusal');
      return originalRename(source, destination, ...args);
    };
    let failure;
    try { assert.throws(() => init(), error => { failure = error; return error instanceof AggregateError; }); }
    finally { fs.renameSync = originalRename; }
    const backups = fs.readdirSync(root, { recursive: true }).filter(file => file.includes('.pagestudio-init-'));
    assert.equal(backups.length, 1); assert.ok(backups[0].endsWith('.bak'));
    const backup = path.join(root, backups[0]);
    assert.ok(failure.message.includes(backup)); assert.match(failure.message, /restore it before rerunning init/);
    assert.equal(fs.readFileSync(backup, 'utf8'), 'Recover these instructions'); assert.equal(fs.statSync(backup).mode & 0o777, 0o640);
    assert.equal(fs.readFileSync(configFile, 'utf8'), '# Preserve config\n');
    fs.renameSync(backup, agentsFile); // Exercise the documented manual recovery.
    init(); assert.ok(init().changes.every(item => item.action === 'unchanged'));
  });
  for (const [name, config] of [
    ['invalid TOML', '[broken'],
    ['conflicting command', '[mcp_servers.pagestudio]\ncommand = "definitely-not-node"'],
    ['wrong root', '[mcp_servers.pagestudio.env]\nPAGESTUDIO_PROJECT_ROOT = "/wrong"'],
    ['remote transport', '[mcp_servers.pagestudio]\nurl = "https://example.com"'],
    ['disabled server', '[mcp_servers.pagestudio]\nenabled = false'],
    ['disabled tool', '[mcp_servers.pagestudio]\ndisabled_tools = ["pagestudio_get_build_status"]'],
    ['unsupported inline partial merge', 'mcp_servers = { pagestudio = { tool_timeout_sec = 99 } }']
  ]) it(`refuses ${name} before changing either file`, () => {
    write(root, 'AGENTS.md', 'Keep local'); write(root, '.codex/config.toml', config);
    assert.throws(() => init());
    assert.equal(fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), 'Keep local');
    assert.equal(fs.readFileSync(path.join(root, '.codex/config.toml'), 'utf8'), config);
  });
  it('rejects malformed or user-edited managed guidance without overwriting it', () => {
    init(); fs.appendFileSync(path.join(root, 'AGENTS.md'), '\n<!-- pagestudio:agent-workflow:start -->');
    assert.throws(() => init(), /Malformed/);
    fs.unlinkSync(path.join(root, 'AGENTS.md')); init();
    const original = fs.readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    write(root, 'AGENTS.md', original.replace('PageStudio template development', 'My custom workflow'));
    assert.throws(() => init(), /guidance was edited/);
  });
  it('leaves unknown-version/customized guidance, outside instructions and Codex config intact', () => {
    init();
    const agentsFile = path.join(root, 'AGENTS.md'), configFile = path.join(root, '.codex/config.toml');
    const customized = '# User instructions before\r\n' + fs.readFileSync(agentsFile, 'utf8').replace('PageStudio template development', 'Earlier or customized workflow') + '\nUser instructions after\n';
    fs.writeFileSync(agentsFile, customized); fs.chmodSync(agentsFile, 0o640);
    const config = fs.readFileSync(configFile);
    for (const dryRun of [true, false]) {
      assert.throws(() => init({ dryRun }), /guidance was edited or is from another version/);
      assert.equal(fs.readFileSync(agentsFile, 'utf8'), customized); assert.equal(fs.statSync(agentsFile).mode & 0o777, 0o640);
      assert.deepEqual(fs.readFileSync(configFile), config);
    }
    assert.ok(!fs.readdirSync(root, { recursive: true }).some(file => file.includes('.pagestudio-init-')));
  });
  it('refuses symlinked config directories and guidance', () => {
    const external = fs.mkdtempSync(path.join(os.tmpdir(), 'ps-external-'));
    try {
      fs.symlinkSync(external, path.join(root, '.codex'), 'dir'); assert.throws(() => init(), /symlink/); assert.deepEqual(fs.readdirSync(external), []);
      fs.unlinkSync(path.join(root, '.codex')); write(external, 'rules.md', 'Keep'); fs.symlinkSync(path.join(external, 'rules.md'), path.join(root, 'AGENTS.md'));
      assert.throws(() => init(), /symlink/); assert.equal(fs.readFileSync(path.join(external, 'rules.md'), 'utf8'), 'Keep');
    } finally { fs.rmSync(external, { recursive: true, force: true }); }
  });
  it('detects nearest project from a nested cwd and honors an explicit root', () => {
    write(root, 'package.json', '{}'); fs.mkdirSync(path.join(root, 'source/nested'), { recursive: true });
    assert.equal(projectRoot(undefined, path.join(root, 'source/nested')), root);
    assert.equal(projectRoot(path.join(root, 'source'), root), path.join(root, 'source'));
  });
  it('escapes quotes/backslashes/control characters as TOML rather than shell interpolation', () => {
    const unusual = path.join(root, 'quote" back\\slash\ttab'); fs.mkdirSync(unusual);
    initialize({ agent: 'codex', projectRoot: unusual });
    const config = parseConfig(fs.readFileSync(path.join(unusual, '.codex/config.toml'), 'utf8'));
    assert.equal(config.mcp_servers.pagestudio.cwd, unusual);
  });
  it('does not mistake a header in a multiline string for a safe merge location', () => {
    const text = 'note = """\n[mcp_servers.pagestudio]\ninside\n"""\nmcp_servers = {pagestudio = {tool_timeout_sec = 99}}\n';
    assert.throws(() => mergeConfig(text, root), /Cannot safely (extend|merge)/);
  });
  it('supports actual CLI init preview and reruns from a nested working directory', () => {
    write(root, 'package.json', '{}'); fs.mkdirSync(path.join(root, 'nested'));
    const call = args => { const result = spawnSync(process.execPath, [cli, ...args], { cwd: path.join(root, 'nested'), encoding: 'utf8' }); if (result.error) throw result.error; return result; };
    const preview = call(['init', '--agent', 'codex', '--dry-run']); assert.equal(preview.status, 0, preview.stderr); assert.match(preview.stdout, /Preview Codex project/);
    assert.ok(!fs.existsSync(path.join(root, '.codex')));
    assert.equal(call(['init', '--agent', 'codex']).status, 0);
    assert.match(call(['init', '--agent', 'codex']).stdout, /UNCHANGED AGENTS.md/);
    assert.equal(call(['init', '--agent', 'other']).status, 1);
  });
});

describe('Codex template kit doctor', function () {
  this.timeout(12000);
  let root, owner, originalContracts;
  beforeEach(() => {
    originalContracts = process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR;
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'ps doctor space-'));
    initialize({ agent: 'codex', projectRoot: root });
    syncContracts({ source: path.join(__dirname, 'fixtures/cms-contracts'), projectRoot: root });
  });
  afterEach(() => {
    if (owner) owner.close(); owner = null; fs.rmSync(root, { recursive: true, force: true });
    if (originalContracts === undefined) delete process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR; else process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR = originalContracts;
  });
  const diagnoseHere = overrides => diagnose({ projectRoot: root }, { probe: async () => {}, ...overrides });
  function ready() {
    owner = createBuildStatus(root);
    owner.update({ state: 'ready', phase: null, generation: 1, activeGeneration: null, pendingChanges: { count: 0, files: [] },
      lastSuccessfulBuild: { generation: 1 }, preview: { state: 'listening' }, assetBuild: 'none (HTML-only readiness)' });
  }
  it('reports expected missing/stopped owners as warnings, without starting a server', async () => {
    let result = await diagnoseHere(); assert.equal(result.exitCode, 0); assert.equal(check(result, 'Dev owner').status, 'WARN');
    assert.ok(!fs.existsSync(path.join(root, '.pagestudio/dev.lock')));
    ready(); owner.close(); owner = null; result = await diagnoseHere(); assert.equal(result.exitCode, 0); assert.match(check(result, 'Dev owner').message, /stopped/);
  });
  it('reports healthy ready session/generation and explicitly warns about HTML-only assets', async () => {
    ready(); const result = await diagnoseHere(); assert.equal(result.exitCode, 0);
    assert.equal(check(result, 'Dev owner').status, 'PASS'); assert.match(check(result, 'Dev owner').message, /generation 1/);
    assert.equal(check(result, 'Owner project').status, 'WARN');
    assert.equal(check(result, 'Live Codex').status, 'NOT_VERIFIED'); assert.equal(check(result, 'Native Codex').status, 'NOT_VERIFIED');
  });
  it('checks configured asset scope and detects an owner/config mismatch', async () => {
    write(root, 'package.json', '{"scripts":{"build-assets":"never executed"}}'); ready();
    let result = await diagnoseHere(); assert.equal(check(result, 'Owner project').status, 'FAIL');
    owner.update({ assetBuild: 'npm:build-assets' }); result = await diagnoseHere(); assert.equal(check(result, 'Owner project').status, 'PASS');
  });
  it('fails on stale or failed owners and distinguishes building from ready', async () => {
    ready(); owner.update({ state: 'building', activeGeneration: 2 });
    let result = await diagnoseHere(); assert.equal(check(result, 'Dev owner').status, 'WARN');
    owner.update({ state: 'failed', failure: { phase: 'assets', code: 1 } });
    result = await diagnoseHere(); assert.equal(result.exitCode, 1); assert.equal(check(result, 'Dev owner').status, 'FAIL');
    const stale = { ...owner.record, heartbeatAt: new Date(Date.now() - 60000).toISOString() };
    for (const file of ['build-status.json', 'dev.lock']) write(root, '.pagestudio/' + file, JSON.stringify(stale));
    result = await diagnoseHere(); assert.equal(result.exitCode, 1); assert.match(check(result, 'Dev owner').message, /stale/);
  });
  for (const kind of ['missing', 'invalid', 'empty', 'missing fixture']) it(`fails with actionable sync instructions for ${kind} contracts`, async () => {
    if (kind === 'missing') fs.rmSync(path.join(root, '.pagestudio/contracts'), { recursive: true });
    if (kind === 'invalid') write(root, '.pagestudio/contracts/manifest.json', '{broken');
    if (kind === 'empty') write(root, '.pagestudio/contracts/manifest.json', '{"schemaVersion":"1.0","renderer":"cms-built-in","blocks":{}}');
    if (kind === 'missing fixture') fs.unlinkSync(path.join(root, '.pagestudio/contracts/block-button.html'));
    const result = await diagnoseHere(); assert.equal(result.exitCode, 1); assert.equal(check(result, 'CMS contracts').status, 'FAIL'); assert.match(check(result, 'CMS contracts').message, /contracts sync --from/);
  });
  it('reports missing dependencies and unsupported Node individually without probing', async () => {
    const result = await diagnoseHere({ nodeVersion: '18.20.0', resolve: name => { if (name.startsWith('sass')) throw new Error('missing'); return name; }, probe: () => assert.fail('must not probe') });
    assert.equal(check(result, 'Node').status, 'FAIL'); assert.equal(check(result, 'Dependencies').status, 'FAIL'); assert.match(check(result, 'Dependencies').message, /sass/);
    assert.equal(check(result, 'MCP protocol').status, 'NOT_VERIFIED'); assert.equal(result.exitCode, 1);
  });
  it('fails invalid/missing configuration and reports a protocol failure separately', async () => {
    fs.unlinkSync(path.join(root, '.codex/config.toml')); let result = await diagnoseHere();
    assert.equal(result.exitCode, 1); assert.equal(check(result, 'MCP protocol').status, 'NOT_VERIFIED');
    initialize({ agent: 'codex', projectRoot: root });
    result = await diagnoseHere({ probe: async () => { throw new Error('Missing MCP tool'); } });
    assert.equal(check(result, 'MCP protocol').status, 'FAIL'); assert.match(check(result, 'MCP protocol').message, /Missing MCP tool/);
  });
  it('honors an explicit verified contract override and checks a selected dev config', async () => {
    fs.renameSync(path.join(root, '.pagestudio/contracts'), path.join(root, 'verified-export'));
    const file = path.join(root, '.codex/config.toml');
    fs.appendFileSync(file, `PAGESTUDIO_BLOCK_CONTRACTS_DIR = ${JSON.stringify(path.join(root, 'verified-export'))}\n`);
    let result = await diagnoseHere(); assert.equal(check(result, 'CMS contracts').status, 'PASS'); assert.equal(check(result, 'Contract override').status, 'WARN');
    result = await diagnose({ projectRoot: root, config: 'missing-site.json' }, { probe: async () => {} });
    assert.equal(result.exitCode, 1); assert.equal(check(result, 'Dev configuration').status, 'FAIL');
  });
  it('probes the actual stdio protocol/tools and exits nonzero for blocking CLI failures', async () => {
    const result = await diagnose({ projectRoot: root }); assert.equal(result.exitCode, 0); assert.equal(check(result, 'MCP protocol').status, 'PASS');
    fs.rmSync(path.join(root, '.pagestudio/contracts'), { recursive: true });
    const child = spawnSync(process.execPath, [cli, 'doctor', '--project-root', root, '--json'], { encoding: 'utf8', timeout: 10000, env: { ...process.env, PAGESTUDIO_BLOCK_CONTRACTS_DIR: '' } });
    if (child.error) throw child.error;
    assert.equal(child.status, 1, child.stderr); assert.equal(JSON.parse(child.stdout).exitCode, 1);
    assert.ok(!fs.existsSync(path.join(root, '.pagestudio/dev.lock')));
  });
});
