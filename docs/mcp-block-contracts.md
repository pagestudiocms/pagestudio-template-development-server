# MCP block contract server (initial integration)

This is a **stdio MCP server**, separate from `pagestudio dev` and `pagestudio proxy-server`. It reads CMS-rendered fixtures offline; it does not synthesize HTML or contact a CMS tenant.

## Prepare a fixture bundle

In the PHP CMS container, export the validated built-in contracts:

```sh
php ./bin/cli tools:blocks:export --output=/var/www/html/var/tmp/block-contracts
```

Copy the **entire directory**, including `manifest.json` and `block-*.json/html`, to a location accessible to the Node process. The exported files are generated artifacts and are not yet published automatically.

## Start

```sh
npm install
PAGESTUDIO_BLOCK_CONTRACTS_DIR=/absolute/path/to/block-contracts npm run mcp
```

Configure your MCP client to execute `node /absolute/path/to/pagestudio-template-development-server/bin/pagestudio-mcp.js` with `PAGESTUDIO_BLOCK_CONTRACTS_DIR` set to the fixture directory. Do not send other output to stdout: it is reserved for MCP messages.

## Tool

`pagestudio_get_block_contract({ "name": "pricing-table" })` returns the enabled block's configuration, renderer classification, complete sample portlets, and actual PHP-rendered HTML. Disabled or unknown blocks return a tool error.

The manifest must use `schemaVersion: "1.0"` and `renderer: "cms-built-in"`. This initial integration does not handle tenant overrides, automatic fixture synchronization, or template validation.
