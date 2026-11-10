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

## Contract-aware template validation

`pagestudio_validate_template({ "file": "example/html/layouts/default.html" })`
checks a project-relative HTML source against `PAGESTUDIO_PROJECT_ROOT`, falling
back to the MCP process working directory. It preserves existing file-level
checks and adds verified CMS Lex structure, CSS/SCSS discovery, fixture selector
matching, conservative styling rules and bounded responsive risks.

Validation never modifies files, compiles SCSS, invokes plugins, contacts tenants
or launches a browser. Missing/incomplete contracts reduce coverage and produce
limitations. Unmatched selectors are observations. Fixture compatibility and
responsive checks use emitted CSS discovered from the existing build configuration,
or authored CSS in plain-CSS projects. CSS/SCSS source remains available for
authoring diagnostics; which assets the selected page loads is not established.
The validator never executes build scripts or JavaScript configuration. Gourmet's
`dev` starts an asset watcher without an initial asset build; `compile` processes
HTML only. Missing/stale CSS requires a manual run of the existing asset build.

Responses retain `schemaVersion: "1.0"`, `file`, `valid`, `findings`, `limitations`
and JSON text for existing clients. Additive `analysis` contains `stylesheets`,
`sourceStylesheets` (authoring-only records), `assets` (expected outputs, source maps,
freshness), loaded `contracts`, selector records and parsed `mediaQueries`. The same object
is returned in MCP `structuredContent`. Only errors make `valid` false; warnings
and `info` do not prove incompatibility.

Every finding has these fields (locations/context may be `null`):

```json
{
  "ruleId": "PS-CSS-101",
  "severity": "warning",
  "file": "assets/site.css",
  "line": 12,
  "column": 3,
  "selector": ".btn",
  "construct": null,
  "block": "button",
  "message": "Declaration may hide sampled CMS content.",
  "evidence": {
    "fixture": "block-button.html",
    "declaration": { "property": "display", "value": "none", "important": false, "line": 12, "column": 3 }
  },
  "explanation": "The selector matches fixture elements; the final cascade may compensate.",
  "recommendation": "Confirm the block should be hidden in this state."
}
```

Selector statuses are `matched`, `unmatched`, `unsupported`. Matching evidence
contains the CMS block, fixture file, count and up to three element samples.
No match means only no loaded fixture matched. Fragment boundaries, dynamic
state, unavailable/stale compiled CSS and unsupported media features limit coverage.
Mapped findings identify SCSS locations when available and keep generated positions
in evidence. Invalid maps fall back to CSS locations. Plain CSS needs no Webpack;
other/dynamic builds can declare local css.outputs in `.pagestudio/validation.json`.

See the [rule catalog](validation-rules.md), [verified syntax](template-syntax.md)
and [implementation phases and limitations](contract-aware-validation.md).
See [existing build discovery, timing, source maps and freshness](css-build-validation.md)
for the Gourmet configuration review and non-Webpack configuration examples.

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

## Project-local contract synchronization

From the template project root, with the development server installed or linked:

```sh
npx pagestudio contracts sync --from /absolute/path/to/exported-block-contracts
```

This copies a validated CMS export into `.pagestudio/contracts/` in the template project. Existing contracts are retained if source validation fails. The command currently accepts a **local CMS export directory**; downloading versioned bundles from a remote registry is not implemented.

The MCP loader resolves contracts in this order:

1. Explicit directory passed programmatically
2. `PAGESTUDIO_BLOCK_CONTRACTS_DIR`
3. `PAGESTUDIO_PROJECT_ROOT/.pagestudio/contracts` (or `process.cwd()/.pagestudio/contracts` when the project root is unset)

Once synced, you may omit `PAGESTUDIO_BLOCK_CONTRACTS_DIR` from `.vscode/mcp.json` if `PAGESTUDIO_PROJECT_ROOT` is set correctly.

Add `.pagestudio/contracts/` to the template project's `.gitignore` if generated fixtures should not be committed.
