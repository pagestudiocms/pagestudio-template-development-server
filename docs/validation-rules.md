# Validation rule catalog

Errors indicate a proven file/syntax failure; warnings identify possible risks
supported by source/fixture evidence; `info` describes an observed interaction
that may be intentional. Only errors set `valid` to false. No fixture absence
implies invalid markup, and no rule mandates undocumented CMS styling.

| ID | Severity | Trigger | Recommended action |
| --- | --- | --- | --- |
| PS-TPL-001 | error | Missing requested HTML file | Check the project-relative path |
| PS-TPL-002 | error | Requested extension is not `.html` | Select an HTML template |
| PS-TPL-003 | warning | Empty or whitespace-only template | Add intended template content |
| PS-TPL-004 | error | Non-file target or symlink escaping root | Select a regular file inside the project |
| PS-TPL-005 | error | HTML file exceeds 1 MiB | Validate a smaller source file |
| PS-CSS-001 | error | CSS/SCSS parser rejects stylesheet | Correct source syntax at parser location |
| PS-ASSET-001 | warning | Expected emitted CSS is missing, or SCSS has no discoverable compiled CSS | Run the project's existing asset build manually; validator never builds |
| PS-ASSET-002 | warning | Compiled CSS has newer known inputs or usable source-map/copied-source content differs | Review stale evidence, manually rebuild and revalidate |
| PS-ASSET-003 | info | Build configuration/output paths cannot be established without executing project code | Declare css.outputs and optional css.sourceRoots in .pagestudio/validation.json |
| PS-CSS-101 | warning | Matched sample declares `display:none`, `visibility:hidden/collapse`, or literal zero opacity | Verify intentional hiding and visible alternatives |
| PS-CSS-102 | info | Important author declaration differs from a normal inline value in sampled matching elements | Confirm intended override |
| PS-CSS-103 | warning | Matched sample receives `all:unset/initial/revert/revert-layer` | Review reset scope and component styling |
| PS-SYN-001 | error | Known CMS Lex delimiter/comment/noparse boundary is incomplete or unmatched | Complete the documented delimiter or pair |
| PS-SYN-002 | error | Known CMS Lex conditional is empty, unmatched, unclosed or has invalid branch order | Correct the conditional structure |
| PS-RESP-001 | warning | Matched element's literal width/min-width exceeds a supported media range upper bound | Preview the range; consider fluid sizing or intentional scrolling |
| PS-RESP-002 | warning | Same selector/property in distinct, overlapping media contexts within one file has different values | Review breakpoint overlap and keep intentional overrides |

Fixture compatibility (PS-CSS-101–103) and responsive (PS-RESP-001–002) rules
operate exclusively on **existing emitted CSS**, or authored CSS for plain-CSS
projects. Raw SCSS supplies authoring syntax/construct diagnostics only. Ordinary
overrides remain valid. Emitted declarations can be attributed to SCSS through
a usable source map; evidence retains their generated CSS locations.

CSS rules describe declarations that could apply; they do not resolve loading,
specificity, conditional feature support, animation, inheritance or the final
cascade. Repeated declarations can therefore produce risks even when later rules
compensate. PS-CSS-102 inspects up to three example elements per block/selector;
it does not compare shorthand/longhand equivalence. It parses inline declaration
syntax without assuming invalid inline CSS proves a conflict.

PS-CSS-001 positive/negative coverage is in `mcp-stylesheet-analysis.spec.js`;
PS-CSS-101–103 each have positive and negative cases in
`mcp-css-compatibility.spec.js`, including ordinary intentional overrides.
PS-SYN-001–002 have positive/negative cases in `mcp-template-syntax.spec.js`.
See [verified syntax sources and limitations](template-syntax.md).
PS-RESP-001–002 have positive/negative cases in `mcp-responsive-analysis.spec.js`.
Neither rule asserts that layout is broken; compensating constraints and
intentional cascade overrides are possible.

PS-ASSET-001–003 have positive/negative cases in `mcp-built-css.spec.js`, which
uses the existing Webpack/Sass loader pipeline only during test setup. Missing
and stale artifacts reduce coverage but do not prove a template incompatible.
PS-ASSET-002 distinguishes content differences (`stale`) from newer input
timestamps (`possibly-stale`); neither proves the final rendering is wrong.
No detected differences leave freshness `unknown`, never proven fresh. A map's
generated intermediate under an SCSS filename is not an authoring snapshot and
is excluded from attribution/content comparison. Missing maps retain generated
locations. See [build discovery, freshness and attribution](css-build-validation.md).
