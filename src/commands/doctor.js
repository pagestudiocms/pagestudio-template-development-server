'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { packageRoot, tools, projectRoot, readLocal, parseConfig, checkServer } = require('./agent-config');

function runtimeDependencies(resolve = require.resolve) {
  const dependencies = Object.keys(require('../../package.json').dependencies);
  const missing = [];
  for (const name of dependencies) {
    try { resolve(name); }
    catch (_) {
      try { resolve(`${name}/package.json`); } catch (_) { missing.push(name); }
    }
  }
  return missing;
}

async function probe(server, contractsDirectory) {
  const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
  const client = new Client({ name: 'pagestudio-doctor', version: '1.0.0' });
  const transport = new StdioClientTransport({ command: server.command, args: server.args, cwd: server.cwd,
    env: { ...process.env, ...server.env, PAGESTUDIO_BLOCK_CONTRACTS_DIR: contractsDirectory }, stderr: 'pipe' });
  // Drain without printing arbitrary server stderr (it can contain local secrets).
  transport.stderr?.on('data', () => {});
  const request = { timeout: 4000 };
  try {
    await client.connect(transport, request);
    const listed = await client.listTools({}, request);
    for (const name of tools) if (!listed.tools.some(tool => tool.name === name)) throw new Error(`Missing MCP tool: ${name}`);
    const result = await client.callTool({ name: 'pagestudio_get_build_status', arguments: {} }, undefined, request);
    if (result.isError) throw new Error('Build-status MCP tool returned isError');
    const status = result.structuredContent || JSON.parse(result.content[0].text);
    if (status.schemaVersion !== '1.0' || typeof status.available !== 'boolean') throw new Error('Invalid MCP build-status response');
    if (status.available && status.projectRoot !== server.cwd) throw new Error('MCP build-status project root does not match configuration');
    return tools;
  } finally { await client.close(); await transport.close(); }
}

async function diagnose(options = {}, dependencies = {}) {
  const checks = [];
  const add = (name, status, message) => checks.push({ name, status, message });
  const nodeVersion = dependencies.nodeVersion || process.versions.node;
  add('Node', Number(nodeVersion.split('.')[0]) >= 20 ? 'PASS' : 'FAIL', `Node ${nodeVersion}; requires >=20 (Commander/open runtime minimum). Install a supported Node release >=20 if needed.`);
  const missing = runtimeDependencies(dependencies.resolve);
  add('Dependencies', missing.length ? 'FAIL' : 'PASS', missing.length ? `Missing/unresolvable: ${missing.join(', ')}. Run npm install in ${packageRoot}; for a published install, reinstall the package from the project.` : 'All declared package runtime dependencies resolve. No packages were installed.');
  let root, server, contractsDirectory, names;
  try { root = projectRoot(options.projectRoot); add('Project root', 'PASS', root); }
  catch (error) { add('Project root', 'FAIL', error.message); }
  if (root) {
    try {
      server = parseConfig(readLocal(root, '.codex/config.toml')).mcp_servers?.pagestudio;
      checkServer(server, root);
      fs.accessSync(server.args[0], fs.constants.R_OK);
      add('Codex configuration', 'PASS', 'Project-local TOML and enabled PageStudio stdio entry are valid; unrelated settings preserved.');
      add('MCP executable', 'PASS', `${server.command} ${server.args[0]} (cwd ${server.cwd})`);
    } catch (error) {
      server = null;
      add('Codex configuration / MCP executable', 'FAIL', `${error.message} Run pagestudio init --agent codex --dry-run; review conflicts before rerunning without --dry-run.`);
    }
    add('Live Codex configuration', 'NOT_VERIFIED', 'Local TOML validity does not prove this VS Code session loaded it. Reload VS Code, open a new Codex session in the intended trusted project; manage trust yourself.');
    contractsDirectory = path.resolve(root, server?.env?.PAGESTUDIO_BLOCK_CONTRACTS_DIR || process.env.PAGESTUDIO_BLOCK_CONTRACTS_DIR || '.pagestudio/contracts');
    try {
      const { createBlockContractLoader } = require('../mcp/block-contracts');
      const loader = createBlockContractLoader(contractsDirectory);
      names = Object.keys(loader.manifest.blocks || {});
      if (!names.length) throw new Error('Manifest has no enabled CMS blocks');
      for (const name of names) loader.load(name);
      add('CMS contracts', 'PASS', `${names.length} validated enabled block fixtures in ${contractsDirectory}. Schema validity does not establish export provenance.`);
      if (contractsDirectory !== path.join(root, '.pagestudio/contracts')) add('Contract override', 'WARN', 'An explicit environment override selects this bundle instead of project-local contracts. Confirm it is the intended verified CMS export.');
    } catch (error) {
      add('CMS contracts', 'FAIL', `${error.message}. Obtain a verified CMS tools:blocks:export directory, then run pagestudio contracts sync --from "/absolute/path/to/verified-cms-export" --project-root ${JSON.stringify(root)}. No contracts were generated.`);
    }
    try {
      const config = require('../dev/config').resolveDevConfig({ config: options.config }, root);
      add('Dev configuration', 'PASS', `${config.configFile}; layouts ${config.layouts}; assets ${config.assetBuild?.label || 'none (HTML-only readiness)'}; asset inputs ${config.assetWatch.join(', ')}. Check these paths against the project source conventions.`);
      const status = require('../dev/build-status').getBuildStatus(root);
      if (!status.available) {
        const expected = ['missing', 'stopped', 'process-not-running'].includes(status.reason);
        add('Dev owner', expected || status.reason === 'updating' ? 'WARN' : 'FAIL', `Unavailable (${status.reason}); no ready build verified. ${expected ? 'Use the existing project npm run start workflow once when ready.' : status.reason === 'updating' ? 'Retry after the in-progress status publication.' : 'Inspect the existing owner/terminal and root; restart the owner after resolving stale or invalid state.'} Doctor starts no server or build.`);
        add('Owner project / asset scope', 'NOT_VERIFIED', 'No live owner scope/session/generation to verify.');
      } else {
        add('Dev owner', status.state === 'failed' ? 'FAIL' : status.ready ? 'PASS' : 'WARN', `${status.state}; projectRoot ${status.projectRoot}; session ${status.sessionId}; generation ${status.generation}. ${status.state === 'failed' ? 'Inspect the dev terminal, fix source, then wait for ready.' : status.ready ? 'Recheck the same session/generation after all affected layouts are validated.' : 'Wait for ready before validation.'}`);
        const expectedScope = config.assetBuild?.label || 'none (HTML-only readiness)';
        const matches = status.projectRoot === root && status.assetBuild === expectedScope;
        add('Owner project / asset scope', !matches ? 'FAIL' : config.assetBuild ? 'PASS' : 'WARN', `${status.assetBuild}; expected ${expectedScope}. ${!matches ? 'Confirm --config and dev CLI overrides, then restart the intended owner with the correct configuration.' : !config.assetBuild ? 'HTML-only readiness cannot attest CSS/JS changes. Configure dev.assetScript and dev.assetWatch for asset work.' : 'Readiness covers configured watched inputs; inspect assetWatch for all affected asset sources.'}`);
      }
    } catch (error) { add('Dev configuration / owner', 'FAIL', `${error.message}. Inspect site.config.json (or pass doctor --config <file>) and existing start-script options.`); }
  }
  if (server && !missing.length && Number(nodeVersion.split('.')[0]) >= 20) {
    try {
      await (dependencies.probe || probe)(server, contractsDirectory);
      add('MCP protocol / tools', 'PASS', `Read-only stdio initialize, tools/list and build-status call succeeded; ${tools.join(', ')}. This diagnostic probe is not a native Codex invocation.`);
    } catch (error) { add('MCP protocol / tools', 'FAIL', `${error.message}. Restore the configured Node/package dependencies, run doctor again, then reload Codex.`); }
  } else add('MCP protocol / tools', 'NOT_VERIFIED', 'Resolve local Node/dependency/configuration failures before probing the MCP server.');
  add('Native Codex invocation', 'NOT_VERIFIED', 'In the VS Code Codex tool picker, discover all three PageStudio tools and directly invoke build status, a real block contract, and validation for each affected layout. Record the calls; no Codex CLI is required.');
  add('Browser appearance', 'NOT_VERIFIED', 'Static diagnostics and build readiness do not verify rendered appearance.');
  return { projectRoot: root || null, checks, exitCode: checks.some(check => check.status === 'FAIL') ? 1 : 0 };
}

async function run(options) {
  const result = await diagnose(options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else for (const check of result.checks) console.log(`${check.status} ${check.name}: ${check.message}`);
  process.exitCode = result.exitCode;
  return result;
}

module.exports = { diagnose, runtimeDependencies, probe, run };
