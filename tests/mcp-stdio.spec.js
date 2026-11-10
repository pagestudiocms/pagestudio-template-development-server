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
    client = new Client({ name: 'pagestudio-mcp-test', version: '1.0.0' });
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [path.resolve(__dirname, '../bin/pagestudio-mcp.js')],
      env: { ...process.env, PAGESTUDIO_BLOCK_CONTRACTS_DIR: root },
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
});
