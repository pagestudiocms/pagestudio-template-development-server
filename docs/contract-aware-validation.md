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

## Phase 2: CSS compatibility rules

`css-compatibility.js` applies the [rule catalog](validation-rules.md) only to
selectors matching successful CMS fixture elements. It reports hidden-content
and broad-reset risks as warnings and inline-important interactions as info.
Each finding includes source/declaration location, selector, block, fixture
evidence, explanation and recommendation. Ordinary overrides are accepted.
Inline CSS parsing is cached within each call, never across project edits.

The checks do not model the cascade or demand CMS visual defaults. Only parser
errors are CSS errors. Each compatibility rule has positive and negative tests.

Phase 2 review: six compatibility-rule tests and all 36 regression tests pass;
one optional external-bundle test is pending. All three compatibility rules have
positive and negative cases. No contract-dependent error rule was invented.

## Phase 3: verified template syntax

The PHP CMS implementation and development parser were inspected before adding
syntax rules. [Source inventory and dialect differences](template-syntax.md)
ground checks for Lex comments, noparse and conditional structure. Unknown or
data-dependent constructs stay unchecked with explicit limitations. No compiler
code is changed and validation never evaluates expressions or invokes plugins.

Phase 3 review: six syntax tests pass, including opaque noparse content, exact
locations and unchanged compilation. Full regression suite passes (42 tests;
one optional external-bundle test pending). No authoritative grammar was found
for full plugin parameters or PHP expressions; these remain explicit limitations.
