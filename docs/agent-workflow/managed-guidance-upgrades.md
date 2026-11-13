# Proposed follow-up issue: version-aware managed guidance upgrades

Proposed GitHub issue title: **feat(dx): safely upgrade versioned agent-workflow guidance**.
This is an issue proposal for follow-up to PR #16; it has not been filed or implemented.

## Current limitation and decision

Init accepts an existing managed `AGENTS.md` block only when it matches the packaged
guidance (allowing CRLF line endings). Otherwise it stops before changing either
AGENTS.md or Codex config. This preserves customizations, but it also stops a
normal package upgrade when the shipped guidance changes. The existing markers
contain no workflow version or original baseline, so a mismatch cannot reliably
distinguish an untouched old release from user-edited instructions.

A safe upgrade requires defining an independently versioned workflow resource,
retaining authoritative old baselines, migrating unversioned blocks and specifying
how customized content is handled. That compatibility and migration work would
significantly expand the initialization rollback fix, so PR #16 keeps its existing
refusal behavior. It never treats the npm package version or a version supplied in
the project's own marker as proof that the text is unmodified.

For now, compare the managed block with the new
`resources/agent-workflow/AGENTS.md` manually. Preserve project-authored instructions
outside the markers. If you customized text inside the block, reconcile it explicitly
and move custom instructions outside the block where appropriate before installing
the exact new shared block. Review the full result in version control and rerun
`pagestudio init --agent codex --dry-run`. Init provides no force-overwrite option.
Keep unresolved conflicts visible; do not delete customized instructions merely to
make initialization pass.

## Proposed issue scope and acceptance criteria

- Give the shared workflow its own version and content digest, separate from the npm
  package version. Retain authoritative baseline text/digests for supported older
  workflow versions. Compare actual block content against a known baseline; a marker
  claiming a version is insufficient.
- Define migration for today's unversioned markers. Automatically recognize a legacy
  block only by an exact match to a supported baseline. Unknown baselines must stop
  with an actionable explanation, never be guessed or silently replaced.
- Offer an explicit, previewable upgrade for recognized, unmodified old blocks.
  Keep normal initialization idempotent and preserve all text outside the markers,
  including its bytes and line endings.
- Detect local edits within a versioned block. Preserve those edits and offer a
  baseline/local/new comparison. If a three-way merge cannot preserve local changes
  unambiguously, stop for manual reconciliation. Never silently overwrite a
  customized block or insert conflict markers into active agent instructions.
- Reuse init's rollback/recovery behavior and preserve both target files and their
  permissions on failure. Do not change trust, MCP settings, contracts or generated
  assets as an incidental effect of a guidance upgrade.
- Test unmodified upgrades, customized/conflicting blocks, unknown/newer versions,
  legacy migration, reruns, dry-run, line endings, outside-block instructions and
  failures during replacement. Document supported baseline retention and recovery.

Upgrading prose is not evidence of native agent loading or obedience. Native Codex
VS Code configuration loading/tool invocation remains **NOT_VERIFIED** until
observed in an actual session. MCP SDK protocol checks remain separate evidence.
