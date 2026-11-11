# Validate the CSS produced by the existing asset build

## Reviewed Gourmet configuration and build timing

These observations describe the pre-issue-11 lifecycle. Current dev owns initial
asset/HTML builds and source watching; see [current lifecycle](dev-build-readiness.md).
Standalone compile still handles HTML only and MCP never executes builds.

The design was checked against the Gourmet template's `package.json`,
`Gruntfile.js` and `webpack.config.js`, and the development server's
`src/commands/dev.js`, `src/commands/compile.js`, `src/compiler/index.js` and
`bin/pagestudio.js` before implementation.

- Gourmet's `build-assets`/`grunt:build` invoke `grunt webpack`.
- Webpack sends `src/scss/style.scss` through sass-loader, css-loader and
  MiniCssExtractPlugin. `output.path` is `compiled/assets/js`, and the plugin's
  `../css/[name].css` emits `compiled/assets/css/style.css`.
- CopyWebpackPlugin copies CSS from `src/css` into `compiled/assets/css`.
- `dev` starts `npx grunt watch` when a Gruntfile exists, alongside HTML compile
  watch and the server. It does **not** run `grunt webpack` before watching.
  Gourmet watches SCSS/JS changes and invokes Webpack on those changes. It does
  not set `atBegin`; grunt-contrib-watch defaults that option to false. `src/css`
  is not a watched target in the inspected Gourmet Gruntfile.
- `compile`, including `--watch`, processes HTML; it does not build CSS assets.
- Gourmet's `build` copies existing compiled CSS into `build/assets/css` for
  packaging. It does not perform the Sass compilation either.

Consequently, starting the dev server or compiling HTML does not prove CSS is
present/current. Run the existing asset build manually when requested by a
diagnostic. The MCP validator never runs scripts, Grunt, Webpack, Sass, plugins,
or JavaScript configuration, and does not add another compilation pipeline.

## Asset discovery and separate authoring analysis

`css-assets.js` parses supported static Webpack configuration using Acorn. A
small AST interpreter reads literals, constant references, arrays/objects,
`path.resolve`/`path.join`, MiniCssExtractPlugin filename options and local
CopyWebpackPlugin patterns. It never uses require/eval on project files.
Supported static exports identify expected extracted CSS entry filenames and
copied CSS files. Known filenames take precedence over scanning a directory:
obsolete files such as Gourmet's `bootstrap-custom-old.css` are not implicitly
validated as current outputs. Output directories are scanned when the filename
cannot be enumerated, with explicit coverage limitations for uncertain builds.

`analysis.stylesheets` and `analysis.selectors` describe the existing emitted
CSS (or ordinary authored CSS in a plain-CSS project). These are the **only**
inputs to fixture matching, compatibility and responsive rules. Source CSS
that is copied is not checked a second time as a compatibility input.

`analysis.sourceStylesheets` retains CSS/SCSS source parser diagnostics and
locations of authoring selectors and constructs, including nesting, imports,
mixins and media queries. Authoring selectors have `authoring-only` status and
are not queried against fixtures. Sass variable resolution, imports and nesting
are taken from the existing compiled artifact, not reimplemented by validation.

Plain CSS requires no Webpack or configuration. With SCSS and no resolvable
Webpack build, existing `compiled/assets/css`, `dist/assets/css` and
`build/assets/css` are fallback candidates with an explicit discovery limitation.
SCSS with no emitted CSS produces a missing-output warning while source checks
continue; unresolved SCSS is never substituted for emitted CSS.

For other build tools, dynamic JavaScript configuration, hashed output paths,
or additional code-split chunks, declare outputs explicitly in project-local
`.pagestudio/validation.json`:

```json
{
  "css": {
    "outputs": ["public/assets/css"],
    "sourceRoots": ["src/scss", "src/css"]
  }
}
```

`outputs` accepts local CSS filenames or directories; `sourceRoots` selects
additional freshness inputs. This overrides static Webpack output discovery.
No script names or executable hooks are accepted. Paths and source maps must
stay within the project root, including symlink resolution. Function exports,
object spreads, arbitrary expressions, glob copy patterns, CSS imported through
JavaScript and code-split dependency graphs are not fully inferred. Use explicit
outputs to cover them. Existing CSS output discovery does not establish which
assets a particular HTML page loads.

## Source-map attribution

The validator reads a local `sourceMappingURL`, adjacent `.css.map`, or an inline
base64 JSON map using @jridgewell/trace-mapping. Version 3 maps can resolve local
relative paths with sourceRoot, file URLs and Webpack source URLs. Remote URLs
are never fetched. Invalid/missing maps do not prevent CSS parsing; PostCSS's
automatic previous-map loading is disabled so map handling remains controlled.

Finding `file`, `line`, `column` identify the mapped SCSS declaration when a
usable local source exists. `evidence.generated`, `evidence.original` and
`evidence.sourceMap` preserve the emitted CSS position and mapping provenance.
Selector records keep generated positions and expose `original` attribution.
Without a usable mapping, generated positions remain and coverage limitations
explain the fallback. Map references to missing local files cannot be clicked
as authoring locations and therefore retain generated locations.

css-loader sometimes stores **intermediate CSS under the SCSS entry's URL**.
When a differing SCSS snapshot is actually a segment of emitted CSS, that source
is excluded from authoring attribution and snapshot comparison. A limitation is
reported. Other genuine imported SCSS sources remain usable. Such an
intermediate snapshot is not evidence of a changed authoring source.

## Missing assets and freshness

`analysis.assets` reports the discovery mode, expected paths and analyzed
artifacts with source-map/freshness metadata. The new rules are in the
[catalog](validation-rules.md):

- PS-ASSET-001: expected compiled CSS is missing (warning).
- PS-ASSET-002: local source/configuration is newer, or usable source-map/copied
  CSS content differs (warning).
- PS-ASSET-003: configuration cannot be fully resolved without execution (info).

`stale` means input content differs from a usable snapshot or copied source;
`possibly-stale` means newer input mtimes were observed. Timestamps alone do not
prove changed output. `unknown` means no change was detected, **not proven
freshness**. Missing dependencies, incomplete maps, generated intermediates,
loader transformations, checkout mtimes and unsupported dependency graphs limit
the inference. Even snapshot differences remain warnings, not errors. Existing
CSS can still be analyzed, with an explicit limitation that findings describe
that artifact rather than the current SCSS.

Extracted CSS considers known entries, source-root CSS/SCSS, build configuration
and local mapped inputs. Copied CSS compares its own source and configuration;
unrelated SCSS changes do not make a copied artifact stale. Changes to imported
files with source-map snapshots can be detected even with older mtimes. Build
configuration is read as data; scripts are never executed to check freshness.

Bounds: 500 files and 10,000 traversal entries per source/output discovery,
1 MiB per source/CSS file, 10 MiB combined CSS/source analysis, 5,000 runtime
selectors and 5,000 authoring selectors/constructs each. Source maps are capped
at 5 MiB and 1,000 sources (inline base64 payloads at 7 MiB). Reached limits
reduce coverage explicitly. Parsing/mapping is scoped to one call, so repeated
requests observe project edits.

## Regression verification

`tests/mcp-built-css.spec.js` builds a temporary fixture using the **existing
Webpack + sass-loader + css-loader + MiniCssExtractPlugin toolchain**, only in
test setup. It verifies Sass nesting, imports, variables and media output,
compiled fixture selector matches, copied CSS de-duplication, source maps,
missing/stale assets, unsupported configuration, plain CSS, non-Webpack outputs,
and MCP JSON/structured parity. The runtime validator imports none of the build
tools. The actual Gourmet configuration and its existing artifacts were also
inspected read-only; no Gourmet scripts were run and no template files changed.
