# LexParser Improvement Plan

This document captures an iterative plan for improving `lib/lexParser.js`, inspired by patterns in `lib/json-template.js`. Each step has a short rationale and acceptance criteria so we can work incrementally.

## 1) Add a Context abstraction

- What: Implement a `Context` class with methods:
  - `pushName(name)`: push a new frame for `name` (supports `@` shorthand)
  - `pop()`: pop the top frame
  - `next()`: advance iterator frame during repeated sections (returns undefined when done)
  - `get(name)`: lookup with dot-notation and lexical stack walk
  - `_Undefined()`: return configured undefined-str
  - support `@index` and `@` resolution
- Why: Enables lexical variable lookup across nested blocks and supports loop indices similar to json-template.
- Acceptance: Existing render behaviors remain functionally same for simple cases; nested resolution works; tests exist for `@index` and nested lookups.

## 2) Replace eval-based conditional evaluation

- What: Remove `eval()` from `evaluateExpression`. Options:
  - A) Integrate a safe expression evaluator (e.g., `jsep` + interpreter or `expr-eval`).
  - B) Implement predicate registry (named predicate functions) and change template `if` to accept either an expression or predicate name.
- Why: `eval()` is a security risk for untrusted templates. json-template uses predicate functions rather than eval.
- Acceptance: Expression evaluation returns same booleans as before on common expressions; unit tests cover string, numeric, comparison and logical ops; no use of `eval` in code.

## 3) Introduce formatter & predicate registries

- What:
  - Implement `SimpleRegistry`, `PrefixRegistry`, `CallableRegistry`, and `ChainedRegistry` patterns (like json-template).
  - Add default formatters: `html`, `htmltag`, `str`, `raw`.
  - Allow syntax like `{{ var|html }}` or a variant if `|` conflicts with existing syntax.
  - Allow predicates to be registered and referenced by name.
- Why: Cleaner extension model for formatting and predicates. Prevent ad-hoc formatting in callbacks.
- Acceptance: Unit tests for formatter usage and chaining; existing callback API still works.

## 4) Formalize compilation/runtime separation & streaming render

- What:
  - Add a compile step producing an executable "program" (array of literal strings and function-invocation statements).
  - Expose `render(context, callback)` to stream output fragments and `expand(context)` to return a complete string.
- Why: Clear separation improves performance (cache compiled templates) and enables streaming large templates (json-template pattern).
- Acceptance: Existing render results unchanged; new `render` callback available and tested.

## 5) Improve loop detection & add `@` / `@index` semantics

- What:
  - Replace heuristic loop detection with explicit opening and closing tokens (or more robust parsing) so loops are not ambiguous.
  - Implement `@` to reference current loop item and `@index` for 1-based or 0-based index (choose and document).
- Why: More robust parsing and parity with json-template features.
- Acceptance: Nested loops work; `@`/`@index` accessible in nested contexts via the new `Context` object.

## 6) Structured error types and better logging

- What:
  - Introduce error objects like `TemplateSyntaxError`, `UndefinedVariable`, `EvaluationError`.
  - Replace console.log in `resolveVariable` with debug logging toggled by an option.
- Why: Better control flow in caller code and clearer test expectations.
- Acceptance: Errors thrown with `name` and `message` fields; tests assert error types.

## 7) Tests, docs, and backward-compatibility safeguards

- What:
  - Add unit tests for tokenization, AST building, context stack, predicates, formatters, and rendering.
  - Update README with new extension points and a migration section describing behavioral changes (e.g., no eval).
  - If any breaking changes are introduced, provide compatibility mode or transition notes.
- Why: Ensures correctness and helps users migrate.
- Acceptance: Test suite passes locally; README updated with examples.

## 8) Optional: Add safe expression-to-predicate compiler

- What: If expression evaluation must be supported, provide a small compiler that converts expression AST to a function that accepts context (no eval).
- Why: Achieves both expressiveness and safety.
- Acceptance: Performance and correctness comparable to the previous `eval` approach in tests.

---

### Next steps
Pick one of the first two items to start (Context abstraction or safe expression evaluation). I can implement it, add tests, and run them locally.

---

*Saved plan in `PLAN.md`.*

- Add more unit tests (loops, nested callbacks).
- Performance: AST caching for inner templates. Add caching for parsed inner ASTs to improve performance.
- Add a README snippet documenting the plugin helper API (helpers.renderInner, helpers.resolveVariables).