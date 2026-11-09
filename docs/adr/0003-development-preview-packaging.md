# ADR 0003: Local development, proxy preview and packaging boundaries

- **Status:** Proposed (existing behavior documented; packaging decision pending)
- **Date:** 2026-11-09
- **Scope:** Template development lifecycle

## Context

The CLI currently exposes `pagestudio compile`, `dev`, `server` and `proxy-server`. Source templates in `src/html` compile into `compiled` for local preview. Proxy preview uses an actual CMS page and local asset rewriting to test styles against real CMS output. There is no established `pagestudio build` packaging command.

## Proposed decision

Keep three distinct concerns:

1. **Compile/develop:** transform local source templates and assets into `compiled` for iterative development.
2. **Proxy preview:** consume real CMS-rendered pages and substitute local assets; do not pretend this generates CMS block DOM.
3. **Package/build (future):** produce a separate, validated distribution artifact (candidate directory `build`) with explicitly defined inclusion, versioning and publishing rules.

MCP contract lookup and validation support authoring but do not replace proxy preview or packaging. Avoid conflating `compiled` with a production-ready package.

## Consequences

- Clearer ownership of preview versus deployable outputs.
- Packaging needs a separate command specification and tests before implementation.
- Proxy preview may require access to a CMS environment, unlike offline MCP lookup.

## Alternatives considered

- **Use `compiled` as final release artifact:** deferred due to unagreed packaging rules.
- **Have Node synthesize CMS block markup:** rejected because CMS owns rendering.

## Open questions

Package layout, asset inclusion/exclusion, tenant compatibility, release metadata and CI publish steps.

## Related

- [ADR 0001](0001-offline-mcp-contracts.md)
- [ADR 0002](0002-template-validation.md)
