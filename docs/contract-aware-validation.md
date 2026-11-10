# Contract-aware validation

The current design uses the existing template asset build's **emitted CSS** for
fixture matching, compatibility and responsive checks. CSS/SCSS source has a
separate authoring pass, and source maps provide SCSS locations where usable.
See [Gourmet build review and current CSS design](css-build-validation.md).
The phase counts/commits below record the original implementation milestones;
the build-aware revision is documented after them.

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

Authoring discovery excludes hidden paths, symlinks, dependencies and generated
`build`, `dist`, `compiled`, `coverage` directories. Build-produced CSS is
discovered separately from expected output paths, including generated directories.
Limits: 10,000 directory entries, 500
stylesheets/blocks, 1 MiB per file and 10 MiB each for stylesheets and fixtures.
Missing/invalid bundles and skipped files become explicit limitations.
`PS-CSS-001` is a parser error with parser location; valid files remain analyzed.

SCSS is not compiled by validation: imports, variables, mixins, interpolation
and nesting are resolved by the project's existing build and inspected through
its emitted CSS. Raw SCSS is parsed for authoring diagnostics only.
Dynamic pseudo classes, pseudo elements and namespaces are
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

## Phase 4: responsive compatibility

`responsive-analysis.js` uses postcss-media-query-parser and
postcss-value-parser to interpret inclusive pixel width ranges. It supports
`screen`/`all`, optional `only`, conjunctions, comma lists and nested media
intersection. Parsed queries are cached per call. Other units, negation, range
syntax, non-width features and container/feature conditions are limitations.
No browser dependency is needed for these bounded static checks.

PS-RESP-001 warns about fixture width/min-width declarations exceeding a media
range upper bound. PS-RESP-002 warns about different responsive values for the
same selector and property in overlapping media contexts in the same file.
Ordinary base-to-responsive overrides, disjoint ranges and equal values do not
trigger overlap findings. Overlap analysis stops at 2,000 matched records or
10,000 comparisons; lists/nested intersections are bounded to 32/64 intervals.
Warnings report possible interactions and never claim visual correctness.

Phase 4 review: seven responsive tests and all 49 regression tests pass; one
optional external-bundle test remains pending. Coverage includes exact inclusive
breakpoints, media lists, nested/disjoint ranges, intentional overrides and
unsupported media features. All responsive findings are warnings.

## Phase 5: actionable MCP diagnostics

The unchanged `{file}` tool input now runs all analyzers. Responses preserve
schema version 1.0 and legacy JSON text and add identical MCP structuredContent.
Every finding has ruleId, severity, file, nullable line/column/selector/construct/
block, message, evidence, explanation and recommendation. Only errors affect
validity. Analysis records describe stylesheet files, loaded blocks, selector
statuses/evidence and supported/unsupported media queries.

Existing file-level checks remain in place, including containment, symlinks,
regular-file status and the 1 MiB HTML limit. Missing contracts reduce coverage;
invalid CSS files do not prevent analysis of other files. MCP advertises
read-only, non-destructive, idempotent, closed-world annotations. Manifest, DOM,
inline-style and media-query caches are scoped to a call; edits cannot leave
persistent cached findings. Selector output is bounded to 5,000 records.
Compiled selector queries are also reused across fixture DOMs. Selector-list
locations identify each individual selector, including multiline lists.

## Unresolved limitations

- Fixtures are finite fragments. Ancestors, sibling variants, alternate CMS
  output and tenant overrides may not be represented; no fixture absence proves
  a selector or markup invalid.
- Fixture checks use the build's existing emitted CSS; source CSS/SCSS is checked
  for authoring diagnostics. Static discovery cannot infer arbitrary executable
  config, JavaScript CSS imports or code-split chunks; use explicit outputs.
  Missing/stale artifacts, source maps and unresolved dependencies limit coverage.
  Asset links, partials and inline style blocks are not expanded.
- SCSS variables, mixins, interpolation and nesting are evaluated only by the
  existing external build, never by validation. Dynamic
  pseudo classes, pseudo elements and namespaces are unsupported.
- CMS syntax coverage is the verified Lex boundary/conditional profile only.
  Plugin parameter grammar, expression validity, PHP, specialty tags and runtime
  data/loop behavior remain unchecked. Full HTML conformance is outside scope.
- Responsive support is inclusive pixel width/min-width/max-width queries with
  screen/all, optional only, and/comma lists and nesting. Other features, units,
  range syntax, negation and containers are unsupported.
- CSS rules inspect emitted declarations without resolving the final cascade,
  shorthand equivalence, stylesheets' load order or browser layout. Intentional
  overrides and compensating declarations can account for reported warnings.
- Resource limits intentionally reduce coverage for large projects. Every
  reached limit/skipped input is reported. No claim of visual correctness is made.

## Phase commits and validation

| Phase | Commit | Validation at phase completion |
| --- | --- | --- |
| 1: discovery/matching | `5a62741` | 7 focused tests; 30 total passed |
| 2: CSS rules/catalog | `ec5dd83` | 6 focused tests; 36 total passed |
| 3: verified Lex syntax | `bb989a9` | 6 focused tests; 42 total passed |
| 4: responsive analysis | `f00103f` | 7 focused tests; 49 total passed |
| 5: MCP integration | final phase commit | stdio, diagnostics, file boundaries, read-only and full real-bundle tests |

The first four normal suite runs each left one optional external-bundle test
pending. The final suite also runs with PAGESTUDIO_BLOCK_CONTRACTS_DIR pointing
to the local CMS export, exercising all 17 blocks and selector matching offline.
Tests require no tenant credentials or PHP process. MCP child-process tests need
working stdio pipes, which this execution sandbox restricts; the same suite is
run with those restrictions lifted.

The feature branch starts at `3b391c0`, the fetched latest
`feat/mcp-template-validation`. Its changes are not present in fetched `main`
(`e27f6dc`); the PR targets the implementation branch to avoid duplicating its
unmerged work. Retarget to main when that dependency is merged.

Phase 5 review: final acceptance run passes **57 tests with no pending tests**
using the complete local CMS export. This includes actual selector matching for
button/pricing-table across all 17 loaded blocks, stdio legacy/structured output
equality, unchanged contract tools, precise locations, warning/info validity,
invalid-file boundaries, deterministic repeat calls, edit invalidation and
read-only file snapshots. `git diff --check` passes.

## Build-aware revision following Gourmet review

Reviewed Gourmet's package scripts, Gruntfile and Webpack configuration, plus the
development server's dev/compile implementation, before changing validation.
Dev starts `grunt watch` without an initial asset build; compile handles HTML.
Gourmet's existing Webpack pipeline emits `compiled/assets/css/style.css` and
copies `src/css` assets. The validator reads those outputs and never runs builds.

`css-assets.js` safely discovers static extracted/copied outputs or explicit
non-Webpack paths. `css-source-maps.js` loads local/inline maps for original SCSS
attribution, retains generated evidence and detects newer or differing inputs.
Intermediate css-loader CSS snapshots under an SCSS URL are not mistaken for
authoring changes. Missing/stale/unresolvable assets have PS-ASSET rule IDs and
explicit coverage limitations. Plain CSS remains supported without Webpack.

The temporary regression fixture uses the existing Webpack + Sass/css loaders
and MiniCssExtractPlugin in test setup. Regression coverage includes nesting,
imports, variables, resolved media, fixture selector matching, copied CSS,
source-map fallback/attribution, freshness, plain CSS, other build tools and MCP.

Build-aware revision acceptance: **74 tests pass, none pending**, with all 17
local CMS exports enabled. Seventeen regressions exercise the Webpack fixture.
Read-only Gourmet inspection selects the extracted `style.css` and copied
`bootstrap-custom.css`, excludes the obsolete output, matches compiled selectors
and maps usable SCSS positions. Its newer package.json produces possible-stale
warnings; generated intermediate source-map snapshots do not produce false
content-staleness claims. `git diff --check` passes. No Gourmet build was run.
