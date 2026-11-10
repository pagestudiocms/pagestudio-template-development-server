'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

describe('MCP stdio protocol', function () {
  this.timeout(10000);
  let root;
  let client;
  let transport;
  before(async function () {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pagestudio-mcp-'));
    fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({
      schemaVersion: '1.0',
      renderer: 'cms-built-in',
      blocks: { button: { fixtureStatus: 'rendered' } },
      fixtures: [{ name: 'button', status: 'rendered', input: 'block-button.json', html: 'block-button.html' }]
    }));
    fs.writeFileSync(path.join(root, 'block-button.json'), '[{"id":"fixed"}]');
    fs.writeFileSync(path.join(root, 'block-button.html'), '<a class="btn">Button text</a>');
    fs.writeFileSync(path.join(root, 'index.html'), '{{ if active }}\n<a>Example</a>');
    fs.writeFileSync(path.join(root, 'site.css'), '@media (max-width:600px) { .btn {display:none; min-width:900px} }');
    client = new Client({ name: 'pagestudio-mcp-test', version: '1.0.0' });
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve(__dirname, '../bin/pagestudio-mcp.js')],
      env: { ...process.env, PAGESTUDIO_BLOCK_CONTRACTS_DIR: root, PAGESTUDIO_PROJECT_ROOT: root },
      stderr: 'pipe'
    });
    await client.connect(transport);
  });
  after(async function () {
    if (client) await client.close();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  });
  it('advertises the contract tool', async function () {
    const result = await client.listTools();
    assert.ok(result.tools.some(tool => tool.name === 'pagestudio_get_block_contract'));
  });
  it('advertises read-only build status and returns unavailable without running scripts or creating status', async function () {
    const listed = await client.listTools();
    const tool = listed.tools.find(item => item.name === 'pagestudio_get_build_status');
    assert.equal(tool.annotations.readOnlyHint, true);
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({scripts:{'build-assets':'touch NEVER_RUN'}}));
    const response = await client.callTool({name:tool.name,arguments:{}});
    assert.deepEqual(response.structuredContent, JSON.parse(response.content[0].text));
    assert.equal(response.structuredContent.state, 'unavailable'); assert.equal(response.structuredContent.ready, false);
    assert.ok(!fs.existsSync(path.join(root, '.pagestudio'))); assert.ok(!fs.existsSync(path.join(root, 'NEVER_RUN')));
  });
  it('returns CMS HTML over MCP', async function () {
    const result = await client.callTool({ name: 'pagestudio_get_block_contract', arguments: { name: 'button' } });
    assert.equal(result.isError, undefined);
    assert.match(JSON.parse(result.content[0].text).fixture.html, /Button text/);
  });
  it('returns tool errors without breaking the session', async function () {
    const result = await client.callTool({ name: 'pagestudio_get_block_contract', arguments: { name: 'navbar' } });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Unknown or disabled/);
  });
  it('advertises read-only validation and returns consistent structured findings plus legacy JSON text', async function () {
    const tools = await client.listTools();
    const tool = tools.tools.find(item => item.name === 'pagestudio_validate_template');
    assert.equal(tool.annotations.readOnlyHint, true);
    const before = fs.readFileSync(path.join(root, 'site.css'));
    const result = await client.callTool({ name: tool.name, arguments: { file: 'index.html' } });
    const data = JSON.parse(result.content[0].text);
    assert.deepEqual(result.structuredContent, data);
    assert.equal(data.schemaVersion, '1.0'); assert.equal(data.valid, false);
    assert.ok(data.findings.some(item => item.ruleId === 'PS-SYN-002'));
    assert.ok(data.findings.some(item => item.ruleId === 'PS-CSS-101'));
    assert.ok(data.findings.some(item => item.ruleId === 'PS-RESP-001'));
    assert.equal(data.analysis.selectors[0].matches[0].block, 'button');
    assert.deepEqual(fs.readFileSync(path.join(root, 'site.css')), before);
    assert.deepEqual(await client.callTool({ name: tool.name, arguments: { file: 'index.html' } }), result);
  });
  it('returns traversal errors and continues servicing contract requests', async function () {
    const result = await client.callTool({ name: 'pagestudio_validate_template', arguments: { file: '../outside.html' } });
    assert.equal(result.isError, true);
    assert.equal((await client.callTool({ name: 'pagestudio_get_block_contract', arguments: { name: 'button' } })).isError, undefined);
  });
});
