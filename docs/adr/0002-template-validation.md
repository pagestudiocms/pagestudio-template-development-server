# ADR 0002: Contract-aware template validation for agents

- **Status:** Proposed
- **Date:** 2026-11-09
- **Scope:** MCP tooling and local template workflow

## Context

Contract lookup gives agents real CMS HTML but does not prove that authored templates and styles are compatible. The next planned tool is `pagestudio_validate_template`; other discussed tools include `pagestudio_get_project_context` and `pagestudio_get_template_syntax`.

## Proposed decision

Implement validation as an explicit, read-only MCP operation that reports machine-readable findings with severity, file/selector evidence, rule identifiers and limitations. Start with checks grounded in exported fixture structure and known template syntax. Distinguish **errors** (provable violations), **warnings** (possible incompatibility) and **informational** findings. Never treat absence from a finite fixture set as proof that all alternative CMS output is invalid.

Add CSS selector and responsive checks only after defining rules and test cases. Keep validation independent of automatic edits; agents may propose fixes but should not silently rewrite template files.

Project-context and template-syntax tools should be separate contracts, with project-local configuration distinguished from CMS-defined syntax.

## Consequences

- More reliable agent feedback with explainable findings.
- Needs approved rule catalog, test fixtures and explicit coverage limits.
- No guarantee of visual correctness; live proxy preview remains necessary.

## Alternatives considered

- **LLM-only review:** rejected as sole validator due to nondeterministic claims.
- **Snapshot string matching as universal validation:** rejected; fixtures represent samples, not all possible DOM variants.
- **Automatically modifying templates during validation:** deferred.

## Open questions

Rule severity policy, supported template dialect, CSS parser, project context discovery and integration with CI remain to be decided.

## Related

- [ADR 0001](0001-offline-mcp-contracts.md)
- CMS ADR 0002.
