#!/usr/bin/env node
'use strict';

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { loadBlockContract } = require('../src/mcp/block-contracts');

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
  }]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'pagestudio_get_block_contract') {
    return { isError: true, content: [{ type: 'text', text: 'Unknown tool' }] };
  }
  try {
    const result = loadBlockContract(request.params.arguments && request.params.arguments.name);
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }
});

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
