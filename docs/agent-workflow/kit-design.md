# Reusable development kit decisions (issue #15)

The audit covered `bin/pagestudio.js`, `bin/pagestudio-mcp.js`, package metadata,
contract sync/loader tests, dev configuration/status, and all existing
`resources/agent-workflow` files, including both client examples and the report.

- Package bins are `pagestudio` and `pagestudio-mcp`; `init --agent codex` and
  `doctor` are additive subcommands on the existing router. Historical README
  `pagestudio-dev`/`pagestudio-compile`/`pagestudio-server` names were incorrect.
  The extensionless compatibility launcher remains unchanged.
- `main` continues to export the compiler through `src/compiler/index.js`; no
  package exports or existing compiler/MCP tools change. The package already ships
  workflow resources through npm's default inclusion rules. Distribution tests now
  check the new command modules as well as the existing reusable resources.
- The prior package declared no Node engine. Commander 14 and open 11 require
  Node >=20; declare that existing practical floor. Node 21.0.0 is the actual Linux
  verification runtime here; this is not a claim of an LTS/platform matrix run.
- Add one dependency, `@iarna/toml`, to validate real TOML before and after textual
  edits. Do not serialize the whole configuration and discard comments. Preserve
  complete matching entries, append an absent entry, or fill missing keys in simple
  explicit tables. Refuse conflicts/unsafe representations before writing either
  target file. No project/user-global configuration or trust is read or changed
  outside the two explicit project targets.
- Retain original file inodes as local recovery copies until both replacements
  succeed. Roll back completed replacements in reverse order on synchronous
  failure, preserving bytes and permissions. Clean up staging/backup files and
  newly created empty directories. If rollback itself fails, retain the original
  backup and report its exact recovery path. This is not crash recovery or locking
  against concurrent writers.
- Resolve Node/package/root once into absolute paths for a reliable VS Code stdio
  launch with spaces in paths, without npx downloads, shell quoting or Codex CLI.
  Local paths are intentionally not portable. Ship the existing placeholder example
  for tracked configuration and explain manual reconciliation after relocation.
- Preserve project guidance outside one marked shared block sourced from the
  existing resource. Refuse edited/outdated blocks instead of silently replacing
  user customizations. Optional Codex skill installation is omitted: the existing
  generic guidance already expresses the complete protocol without duplicating it.
  [Version-aware upgrades](managed-guidance-upgrades.md) are proposed as a separate
  issue because safe baseline retention, legacy migration and customized-block
  handling add a compatibility mechanism beyond this rollback correction.
- Doctor reuses contract loading, dev configuration and cross-process status.
  Dependencies are checked by resolution, not installation/execution of arbitrary
  project code. Only the known Node and this installation's MCP script may be
  probed. The bounded protocol probe exercises initialize, tools/list and read-only
  status; it does not build or start an owner. Missing/stopped owners are expected
  warnings, while malformed/stale/failed readiness is blocking.
- Owner status publishes its asset label, not full CLI overrides/watch topology.
  Doctor compares root/label against the selected config and prints configured
  inputs. It cannot independently attest custom start-script flags or every input;
  source inspection and same-session/generation rechecks remain mandatory.
- No new compiler, MCP build executor, agent harness, browser automation, contract
  generator or diagnostic rules are added. The disposable adoption script is an
  explicit test exercise; init/doctor/MCP never call it.

Installation, exact commands, merge limitations, exit statuses and VS Code native
invocation steps are in [the adoption guide](README.md). The official OpenAI
[MCP documentation](https://developers.openai.com/codex/mcp) establishes stdio
command/args/env/cwd and shared IDE configuration; the
[configuration documentation](https://developers.openai.com/codex/config-basic)
establishes project scope and trust. Neither local TOML parsing nor an SDK probe
proves a running Codex session loaded the config or invoked the tools natively.
