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

The manifest must use `schemaVersion: "1.0"` and `renderer: "cms-built-in"`. This integration does not handle tenant overrides or automatic fixture synchronization.

## Preliminary template validation

`pagestudio_validate_template({ "file": "example/html/layouts/default.html" })` checks a project-relative HTML file against `PAGESTUDIO_PROJECT_ROOT`, falling back to the MCP process working directory. The tool returns `schemaVersion`, `valid`, `findings` (with rule IDs, severity, file and message), and explicit `limitations`.

This first increment checks existence, regular-file status, extension, empty content, a 1 MiB size limit, and project-root containment (including symlink resolution). It does **not** parse PageStudio syntax or validate CMS DOM/CSS compatibility yet. Validation never modifies files. Set `PAGESTUDIO_PROJECT_ROOT` to the absolute path of the template project. If unset, the MCP process working directory is used.

For VS Code, configure the MCP server in the template project's `.vscode/mcp.json`:

```json
{
  "servers": {
    "pagestudio": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/pagestudio-template-development-server/bin/pagestudio-mcp.js"],
      "env": {
        "PAGESTUDIO_PROJECT_ROOT": "/absolute/path/to/template-project",
        "PAGESTUDIO_BLOCK_CONTRACTS_DIR": "/absolute/path/to/block-contracts"
      }
    }
  }
}
```

The MCP server executable may be installed elsewhere; the project root selects the files to validate. The fixture directory independently selects the CMS contract bundle.
