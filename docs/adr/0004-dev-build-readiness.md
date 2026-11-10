# ADR 0004: One dev owner and cross-process build readiness

- **Status:** Accepted
- **Date:** 2026-11-10
- **Scope:** Issue #11; dev lifecycle and read-only MCP status

## Context

Independent Grunt/HTML watchers cannot attest one build generation. Grunt watch
omits initial compilation and Gourmet copied CSS. Separately launched MCP servers
need to distinguish building/failed/stopped owners from current ready output.

## Decision

Dev owns a watcher, serialized/debounced queue, child processes and project status.
Reuse existing one-shot asset commands and the HTML compiler; do not launch extra
build watchers or introduce another Sass/JS pipeline. HTML-only/custom projects
remain supported. Preview acknowledges listening before ready is published.

Publish atomic status/ownership records with session, PID/start identity where
available, heartbeat, generation, pending inputs, failures and success history.
Readers reject stale/stopped/mismatched owners and inconsistent/partial transitions.
Shutdown invalidates readiness before waiting for child teardown. Dead-owner recovery
is guarded; live owners cannot be displaced.

MCP only reads status. Agents check the same ready session/generation before and
after validation. No scripts or build processes run from MCP tools. Existing
validation and block contracts remain unchanged.

## Consequences and limits

- Initial build and copied CSS/data/partial watching become reliable from npm start.
- Compile rejections propagate to CLI exit status; fresh one-shot compilers reload inputs.
- Configuration changes require restart to reload commands/watch topology.
- Observed-input/process completion does not prove semantics, visual correctness,
  immutable source snapshots or external writes.
- Heartbeats have a 10-second stale bound; Linux adds process-start identity.
- POSIX process groups are integration tested; Windows cmd/taskkill handling is unverified.

## Alternatives

- Another compiler duplicates project build conventions.
- Output timestamp polling cannot prove active/failed build generations.
- Executing builds from MCP violates read-only tooling.

See [workflow, status schema, configuration and limits](../dev-build-readiness.md).
