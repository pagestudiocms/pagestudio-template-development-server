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
| PS-CSS-101 | warning | Matched sample declares `display:none`, `visibility:hidden/collapse`, or literal zero opacity | Verify intentional hiding and visible alternatives |
| PS-CSS-102 | info | Important author declaration differs from a normal inline value in sampled matching elements | Confirm intended override |
| PS-CSS-103 | warning | Matched sample receives `all:unset/initial/revert/revert-layer` | Review reset scope and component styling |

CSS rules describe declarations that could apply; they do not resolve loading,
specificity, conditional feature support, animation, inheritance or the final
cascade. Repeated declarations can therefore produce risks even when later rules
compensate. PS-CSS-102 inspects up to three example elements per block/selector;
it does not compare shorthand/longhand equivalence. It parses inline declaration
syntax without assuming invalid inline CSS proves a conflict.

PS-CSS-001 positive/negative coverage is in `mcp-stylesheet-analysis.spec.js`;
PS-CSS-101–103 each have positive and negative cases in
`mcp-css-compatibility.spec.js`, including ordinary intentional overrides.
