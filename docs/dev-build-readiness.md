# Development lifecycle and agent build readiness

## Ownership decision (issue #11)

Reviewed dev/compile commands, CLI defaults, compiler/watch/file utilities, MCP
registration and Gourmet's package.json, Gruntfile.js and webpack.config.js before
implementation. Previously dev launched separate Grunt watch, HTML watch and
preview children. Grunt watch did not guarantee an initial build; Gourmet omitted
copied src/css inputs. HTML watch omitted data JSON and rebuilt only the last
layout after partial edits. Compile rejections were not awaited by the CLI.

Dev now owns one watcher and a serialized queue around the existing one-shot asset
command and HTML compiler. It does not launch Grunt watch or another HTML watcher.
Preview remains the existing server child, with an explicit listening handshake.
No additional Sass/JS compiler is introduced. Standalone compile/watch still works.

## Start and configuration

After installing/linking the updated package, a template whose start script invokes
pagestudio dev uses one command:

```sh
npm run start
```

Gourmet's existing extensionless `node .../bin/pagestudio dev` invocation is retained
by a compatibility launcher. No template Grunt/Webpack changes are required.

Asset selection: explicit --asset-script / dev.assetScript, then existing npm
build-assets, then grunt:build, then `npx --no-install grunt webpack` when both
Gruntfile.js and webpack.config.js exist. Generic build/packaging scripts are never
inferred. `--asset-script none` or dev.assetScript false disables assets; projects
without a detected pipeline report readiness explicitly scoped to HTML only.
Scripts must be one-shot and have a conventional npm name (letters/digits/_/./:/-).

For a different builder/source layout, configure site.config.json:

```json
{
  "src": "src/html",
  "out": "compiled",
  "dev": {
    "assetScript": "compile-assets",
    "assetWatch": ["styles", "scripts", "public-css"],
    "debounceMs": 100
  }
}
```

assetScript names an existing npm script, not a shell command. assetWatch accepts
literal paths, not globs (chokidar 4). CLI --asset-script, --asset-watch (comma
separated), --debounce, --config and HTML/preview options override config. Port 0
selects a free preview port, which is published after listening. Custom --out is
passed to both preview's root and assets mount.

Default asset inputs are scss/js/css next to the HTML source (src/scss, src/js,
src/css in Gourmet). HTML inputs include configured layouts, partials, JSON data,
src/plugins and src/template.conf. Partial/data changes rebuild all layouts through
a fresh compiler; deleted layouts remove their generated page. Output, node_modules,
.git and .pagestudio are excluded. Initial scanning finishes before initial builds.

Observed edits are debounced; assets and HTML never build concurrently. Changes
observed during a build require a subsequent generation before ready. Build errors
remain visible in the terminal and status; a later edit retries failed phases.
Successful phases clear their own failures. Existing outputs may remain previewable
while status is failed. Configuration/package/Grunt/Webpack edits invalidate readiness
and require restart to reload command selection and watch topology.

SIGINT/SIGTERM invalidate readiness immediately, close watching and terminate owned
child groups with a bounded force-kill fallback. Watcher/preview failures are fatal
and clean up. A second live owner is rejected. Dead-owner recovery uses an exclusive
recovery guard. Invalid locks or abandoned recovery guards require inspection and
manual removal only after the old owner has stopped. Do not run an external asset
watcher/builder concurrently: dev cannot serialize or attest external writes.

## Project status and MCP

Dev atomically replaces .pagestudio/build-status.json and .pagestudio/dev.lock,
with owner-only file permissions. Ignore those files, dev.lock.recovery and *.tmp
under .pagestudio in template gitignore rules. MCP only reads them, using
PAGESTUDIO_PROJECT_ROOT (cwd fallback), matching dev's project working directory.
No status directory, scripts, builds or watcher is created by MCP.

pagestudio_get_build_status({}) returns identical JSON text and structuredContent:

| Field | Meaning |
| --- | --- |
| available, ready, state | idle/building/ready/failed, or unavailable when ownership is invalid |
| sessionId, pid, startedAt, heartbeatAt | Current owner and liveness evidence |
| generation, activeGeneration | Latest observed generation and currently building generation |
| pendingChanges | Pending count and bounded relative filenames |
| lastSuccessfulBuild | Last ready generation/time, history only after failure/new edits |
| phase, failure | Phase and sanitized exit code; never raw child stderr, credentials or stack |
| preview | Listening host/actual port, or starting/stopped |
| assetBuild | Selected existing pipeline, or explicit HTML-only readiness scope |

Idle with pending edits, building and failed are not ready. A new owner gets a new
session and resets success history. The reader rejects stopped/dead owners,
heartbeats older than 10 seconds, session/PID identity mismatches and inconsistent
generations. /proc process start identity additionally detects Linux PID reuse.
Ownership is updated before status, so partially published transitions cannot use
the old ready state. Unavailable has a reason and sanitized last failure where
available; previous success is never returned as current readiness.

Agent workflow:

1. Read build status. Unavailable means start/restart dev through the developer
   workflow, not through MCP. Idle/building means recheck later.
2. On failure, inspect terminal output, fix the source and await a successful
   generation. Configuration changes require restarting npm run start.
3. Save a ready sessionId/generation and call pagestudio_validate_template.
4. Read status again. Use findings as current only if the same session/generation
   remains ready; otherwise repeat after the next build.

## Limitations and verification

Readiness attests observed watched inputs and successful command exits, not an
immutable snapshot, semantic correctness of custom scripts, swallowed plugin
errors, or browser appearance. Configure extra dependency paths explicitly.
Heartbeat freshness is bounded; non-/proc platforms use PID/session/heartbeat
rather than Linux's extra start-identity check. POSIX process groups are covered
by integration tests; Windows cmd-shim/taskkill support remains unverified in this
Linux suite. Hard kill can leave partial outputs but cannot leave current readiness;
restart performs an initial build. A crashed recovery guard needs manual inspection.

Tests use temporary projects, real npm start + independent MCP + HTTP processes,
and the existing Grunt/Webpack/Sass toolchain. Coverage includes initial builds,
all input types, rapid edits, failure/recovery, status/restarts, duplicate owners,
preview bind failure, active-build shutdown and custom/HTML-only projects. No real
Gourmet files or outputs are modified, and no project code executes inside MCP.

Final verification: 103 tests pass with no pending tests, including all 17 local
CMS fixtures. This includes 12 real-process lifecycle cases and explicit tests
for immediate shutdown invalidation, dead-owner recovery and partial publications.
`git diff --check` passes. The tests build only temporary projects; Gourmet's
working files and existing output are preserved.
