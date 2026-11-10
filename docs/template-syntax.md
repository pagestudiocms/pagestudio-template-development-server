# Verified PageStudio template syntax

Validation uses a deliberately bounded **CMS Lex** syntax profile. It does not
run PHP or change the development HTML compiler. Sources inspected before adding
rules: CMS repository at commit `07766646e627cb42df794c6d7736d8e55e24af70`:

- `src/app1/libraries/MY_Parser.php::_parse` instantiates Lex_Parser and sets `:` scope glue.
- `src/app1/libraries/Lex/Parser.php::setup_regex` defines double-brace variables,
  paired variables, callback blocks, recursive tags, noparse, `if`, `elseif`,
  `else`, `/if` and `endif` delimiters.
- `parse_comments` removes `{{# ... #}}`; `parse` removes comments before
  `extract_noparse`, then extracts loops and parses conditionals before callbacks.
- `parse_conditionals` translates conditions to PHP alternative syntax. This
  verifies that conditions require an expression and properly ordered branches
  and closers. Validation never evaluates those expressions.

Local development sources inspected: `src/compiler/parser.js`,
`src/lib/lexParser.js`, `docs/PARSER.md` and the existing conditional tests.
Development parsing additionally rewrites `<plugin:method .../>` and
`{{ template:partial name="..." }}`. Its tokenizer includes `unless` and
`elseunless`; the inspected CMS regex does not implement those. Design prose in
`docs/PARSER.md` alone is not treated as a full CMS syntax specification.

| Verified construct | Validation coverage |
| --- | --- |
| `{{# comment #}}` | Boundary pairing; comments masked before other analysis |
| `{{ noparse }}...{{ /noparse }}` | Pairing; body is opaque |
| `{{ if expression }}` / `{{ elseif expression }}` | Expression presence and conditional structure |
| `{{ else }}` / `{{ endif }}` / `{{ /if }}` | Branch order, nesting and pairing |
| Variables, paired variables, plugin callbacks and recursive tags | Recognized as outside structural checking; data/plugin dependent |

PS-SYN-001 reports malformed known boundaries; PS-SYN-002 reports malformed
conditional structure. Locations are one-based line/column at the construct
opener, with a source offset in evidence. Unknown tags and delimiters are not
automatically errors. Alternative conditional dialects produce explicit coverage
limitations. Conditions embedded in callback-provided strings, runtime output,
PHP, plugin parameter grammars and includes/partials are not expanded or checked.
The profile checks the requested source only. It does not promise full PHP
parser equivalence or enforce all markup syntax.

Tests: `npx mocha tests/mcp-template-syntax.spec.js`; each rule has positive and
negative tests, and a compilation regression test verifies unchanged output.
