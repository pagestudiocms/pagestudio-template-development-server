#!/usr/bin/env node
'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { loadBlockContract } = require('../src/mcp/block-contracts');
const { validateTemplate } = require('../src/mcp/template-validation');
const { getBuildStatus } = require('../src/dev/build-status');

const server = new Server({ name: 'pagestudio-template-development-server', version: '0.1.0' }, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'pagestudio_get_block_contract',
    description: 'Get authoritative CMS built-in block configuration, sample input, and actual renderer HTML from an exported fixture bundle.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'PageStudio block type, e.g. text-heading or pricing-table' } },
      required: ['name'],
      additionalProperties: false
    }
  }, {
    name: 'pagestudio_validate_template',
    description: 'Read-only offline HTML and CSS/SCSS authoring validation; matches existing build-produced or plain CSS to CMS fixtures, with source-map attribution, asset freshness, bounded responsive risks and explicit limitations.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: { file: { type: 'string', description: 'Project-relative HTML template path' } },
      required: ['file'],
      additionalProperties: false
    }
  }, {
    name: 'pagestudio_get_build_status',
    description: 'Read current project dev build readiness across processes. Missing, stopped or stale owners are unavailable, never success. Check session and generation before and after validating compiled output. Never executes project scripts.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: 'object', properties: {}, additionalProperties: false }
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!['pagestudio_get_block_contract', 'pagestudio_validate_template', 'pagestudio_get_build_status'].includes(request.params.name)) {
    return { isError: true, content: [{ type: 'text', text: 'Unknown tool' }] };
  }
  try {
    const args = request.params.arguments || {};
    const result = request.params.name === 'pagestudio_get_build_status' ? getBuildStatus()
      : request.params.name === 'pagestudio_validate_template'
      ? validateTemplate(args.file)
      : loadBlockContract(args.name);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], structuredContent: result };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
