# ADR 0002: Contract-aware template validation for agents

- **Status:** Accepted
- **Date:** 2026-11-09
- **Scope:** MCP tooling and local template workflow

## Context

Contract lookup supplies real CMS HTML but does not prove template compatibility.
`pagestudio_validate_template` extends preliminary file checks with bounded offline
analysis. Context and syntax-discovery tools remain separate future contracts.

## Decision

Validation is an explicit read-only MCP operation. Errors indicate proven file or
syntax failures; warnings describe possible risks; info describes interactions
that may be intentional. Fixture absence never proves markup invalid.

Use PostCSS/postcss-scss for source, postcss-selector-parser for selectors,
htmlparser2/css-select for fixture DOM queries, and media-query/value parsers for
bounded responsive analysis. CSS fixture/compatibility/responsive inputs are the
existing artifacts produced by the template's own build, or authored plain CSS.
SCSS source is checked separately for authoring syntax. No Sass evaluation or
browser dependency is needed in validation. The existing asset pipeline remains
responsible for resolving imports, nesting, variables and media output.
Use per-call manifest/DOM/inline-style/media caches with explicit discovery and
size limits; avoid persistent caches that can return stale project content.

Discover static Webpack/MiniCssExtractPlugin/CopyWebpackPlugin outputs with Acorn;
never require or execute project configuration. Support explicit local output
paths for other/dynamic build tools and conventional output fallback where needed.
Use trace-mapping to attribute generated findings to local SCSS and retain emitted
locations in evidence. Missing/invalid/synthetic source-map entries fall back to
generated locations. Missing or possibly stale assets are explicit warnings and
limitations; timestamps alone cannot prove staleness or freshness.

The [Gourmet configuration review](../css-build-validation.md) establishes that
the former dev command started only a Grunt watcher; standalone compile handles
HTML only. [ADR 0004](0004-dev-build-readiness.md) adds initial dev builds and readiness. Validation never runs a build to compensate. No redundant Sass pipeline
is added; tests use the existing Webpack loader toolchain in temporary fixtures.

Apply the [tested rule catalog](../validation-rules.md). Unmatched selectors are
observations, unsupported selectors/contexts reduce coverage, and ordinary CSS
overrides are accepted. Visibility suppression and broad resets are warnings;
important overrides of sample inline values are informational. Responsive checks
warn about bounded fixed-width and overlapping-declaration risks, never visual
failure. Syntax rules are grounded in the inspected PHP CMS Lex implementation,
with documented differences from the development parser.

Preserve schema version 1.0 and legacy JSON text, adding uniform nullable source
and context fields, evidence, explanations, recommendations and analysis records.
Return the same object as MCP structuredContent and advertise read-only tooling.
Only errors affect `valid`. Validation never modifies templates.

## Consequences

- Agents receive actionable findings backed by source and fixture evidence.
- Rule catalog, real renderer samples, tests and limitations accompany each phase.
- No guarantee of visual correctness; live proxy preview remains necessary.
- Compiler behavior and existing file-level validation remain unchanged.

## Alternatives considered

- LLM-only validation cannot provide deterministic claims.
- Universal snapshot matching misrepresents finite sample output.
- Browser-driven validation is unnecessary for the bounded static rules.
- Automatic template rewriting is outside this tool's read-only contract.

## Limitations

Finite fragment fixtures cannot enumerate all CMS markup. Asset loading, imports,
runtime SCSS expansion, inline style blocks, final cascade, dynamic state and browser
layout are not resolved. Media support is restricted to inclusive pixel width
queries; other conditions are limitations. Syntax checks validate known Lex
boundaries and conditional structure, not plugin parameters, PHP expression
grammar or data-dependent loops. Full HTML conformance is outside this profile.
See the [phase report](../contract-aware-validation.md) for bounds and validation.
CSS source maps and build outputs may be incomplete or stale; declared outputs
are needed for unsupported configuration and code-split/imported-JavaScript CSS.

## Related

- [ADR 0001](0001-offline-mcp-contracts.md)
- [Verified syntax sources](../template-syntax.md)
- CMS ADR 0002
