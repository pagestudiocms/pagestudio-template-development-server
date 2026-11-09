# ADR 0001: Offline MCP block contract interface

- **Status:** Accepted (implemented on feature branch; pending merge)
- **Date:** 2026-11-09
- **Scope:** Node.js template development server

## Context

VS Code/Copilot and other coding agents need authoritative PageStudio block structure, but the template development server must not duplicate PHP rendering or depend on a running tenant.

## Decision

Provide a standalone Model Context Protocol server over **stdio**. The MCP tool `pagestudio_get_block_contract` reads a local exported CMS bundle specified by `PAGESTUDIO_BLOCK_CONTRACTS_DIR` (or the documented default). It validates manifest schema version `1.0`, built-in renderer mode, enabled block identity and successful fixture status, then returns block metadata, complete JSON input and PHP-rendered HTML.

Run via `npm run mcp` or directly with `node bin/pagestudio-mcp.js`. Keep MCP protocol output on stdout; diagnostics belong on stderr. MCP runs separately from `pagestudio dev` and `pagestudio proxy-server`.

## Consequences

- Offline, editor-friendly integration with no PHP process or CMS tenant required during lookup.
- Fixture freshness depends on export and distribution workflow.
- The initial tool supports built-in block contracts only, not tenant overrides.
- No template validation or CSS analysis is implied by contract retrieval.

## Alternatives considered

- **MCP implemented in PHP CMS:** rejected to keep local agent integration independent of CMS runtime.
- **HTTP MCP server:** deferred; stdio suits locally launched editor clients.
- **Node-generated HTML fixtures:** rejected because PHP renderers are authoritative.

## Related

- CMS ADR 0001 and 0002.
- Feature branch `feat/mcp-block-contracts`.
