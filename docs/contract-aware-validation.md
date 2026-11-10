# Contract-aware validation

## Phase 1: stylesheet discovery and matching

`src/mcp/stylesheet-analysis.js` discovers CSS/SCSS in sorted project-relative
order. PostCSS and postcss-scss parse source, postcss-selector-parser parses
selector lists, and css-select queries htmlparser2 DOM fragments from successful
CMS exports. Fixture DOMs are parsed once per validation call; no persistent cache
can leave edits stale. Contracts retain the existing environment override, then
project-local `.pagestudio/contracts/` resolution.

Selector records contain source location, declarations, media context and
`matched`, `unmatched` or `unsupported` status. Matches contain block, fixture,
element count and up to three attribute/tag samples. Unmatched means only that no
loaded sample matched. It never makes a template invalid.

Discovery excludes hidden paths, symlinks, dependencies and generated
`build`, `dist`, `coverage` directories. Limits: 10,000 directory entries, 500
stylesheets/blocks, 1 MiB per file and 10 MiB each for stylesheets and fixtures.
Missing/invalid bundles and skipped files become explicit limitations.
`PS-CSS-001` is a parser error with parser location; valid files remain analyzed.

SCSS is not compiled: imports, variables, mixins, interpolation and nesting are
not evaluated. Dynamic pseudo classes, pseudo elements and namespaces are
unsupported. Keyframe steps are not DOM selectors. Stylesheet discovery does not
establish which stylesheets a page loads or the browser cascade.

Tests: `npx mocha tests/mcp-stylesheet-analysis.spec.js` uses checked-in real
CMS-rendered samples and verifies missing contracts, boundaries and read-only,
deterministic behavior.

Phase 1 review: selector/discovery tests pass (7); full suite passes (30, with
one optional external-bundle test pending). MCP child-process tests require the
execution environment to permit stdio pipes; they pass outside the restricted
sandbox. No compiler or MCP behavior has changed in this phase.
