# MCP-guided template development

Use this workflow in a PageStudio **template repository**. It combines the existing
CMS fixture contracts, read-only validator and running dev owner's build status.
It adds no compiler, agent control plane, browser automation or build execution
inside MCP. Paths come from the adopting project rather than a Gourmet convention.

## Installation and initialization (Codex VS Code)

The actual package executables are `pagestudio` and `pagestudio-mcp`. Codex CLI is
not required. Node **>=20** is required by the CLI/runtime dependencies; use a
currently supported Node release. This kit adds onboarding, not a new builder or
agent executor. Inspect the template's package scripts, site/build configuration,
source conventions and asset inputs before changing its development workflow.

### Published package

Use a release that includes `init` and `doctor` (confirm with `--help`; the existing
`3.0.0-beta1` version string alone does not prove these capabilities). This package
publishes to **GitHub Packages**, not the public npm registry. Configure your npm
scope and authenticate to GitHub Packages with your own package-read credentials
following your organization's process; never commit a token:

```sh
npm config set @pagestudiocms:registry https://npm.pkg.github.com
npm install --save-dev @pagestudiocms/pagestudio-template-development-server
npx --no-install pagestudio --help
```

Run these commands in the template root after installing:

```sh
npx --no-install pagestudio init --agent codex --dry-run
npx --no-install pagestudio init --agent codex
npx --no-install pagestudio contracts sync --from "/absolute/path/to/verified-cms-export"
npx --no-install pagestudio doctor
# Reuse a running dev owner. If none is running, start the existing project workflow once:
npm run start
```

`--no-install` prevents npx from fetching a different package when the local bin is
missing. The installer does not add or replace `start`/asset scripts. For a new
project, configure its sources and existing one-shot asset pipeline using the
[dev lifecycle guide](../dev-build-readiness.md); an npm packaging build is not
necessarily an appropriate asset builder.

### Local development checkout

Install dependencies in the development-server checkout, then link it from the
adopting template. Use absolute paths and quote paths containing spaces:

```sh
cd "/absolute/path/to/development-server"
npm ci
cd "/absolute/path/to/template"
npm install --save-dev "/absolute/path/to/development-server"
npx --no-install pagestudio init --agent codex --dry-run
npx --no-install pagestudio init --agent codex
```

Alternatively, without installing into the template, run the checkout's CLI
explicitly (after `npm ci` in that checkout):

```sh
node "/absolute/path/to/development-server/bin/pagestudio.js" init --agent codex --project-root "/absolute/path/to/template"
node "/absolute/path/to/development-server/bin/pagestudio.js" contracts sync --from "/absolute/path/to/verified-cms-export" --project-root "/absolute/path/to/template"
node "/absolute/path/to/development-server/bin/pagestudio.js" doctor --project-root "/absolute/path/to/template"
```

### What initialization changes

- Root selection: explicit `--project-root`, then `PAGESTUDIO_PROJECT_ROOT`, otherwise
  the nearest ancestor containing `package.json` or `.git`; an empty directory uses
  the current directory. Roots are canonicalized. Nested commands therefore target
  the nearest package/repository; use the explicit flag for monorepos.
- `AGENTS.md`: append one marked block from the shipped
  `resources/agent-workflow/AGENTS.md`, retaining all project text. Keep project rules
  outside the markers. An unchanged rerun writes nothing. Edited/outdated/malformed
  managed blocks require manual reconciliation against the shipped resource.
  Automatic version-aware upgrades are deferred; see the
  [limitation and proposed follow-up issue](managed-guidance-upgrades.md).
- `.codex/config.toml`: use the current absolute Node executable, this package's
  absolute MCP script, and the canonical template root as both cwd and
  `PAGESTUDIO_PROJECT_ROOT`. Preserve existing settings, comments, other servers and
  custom PageStudio fields. Fill missing fields in simple explicit PageStudio tables.
  Complete equivalent entries (including a resolvable `command = "node"`) are retained.
  Conflicts, invalid TOML, symlinks and representations that cannot safely be extended
  stop initialization before either file is changed. Partial inline/quoted/dotted
  representations may need manual conversion to explicit tables. Review the error
  and the shipped example; rerun `--dry-run` after resolving it.

Init stages the complete plan and retains original files until both replacements
succeed. If either replacement fails, it rolls back completed changes, restoring
original contents and permissions and removing files created by that attempt.
Successful runs and recovered failures remove staging files and backups; failed
attempts also remove any newly created empty config directory. If the filesystem
refuses rollback too, the error identifies the retained original `.bak` file and
target for manual restoration. Restore that original before rerunning init; a
failed rollback never silently deletes its recovery copy. Cleanup failures likewise
report the remaining artifact paths. This handles synchronous filesystem errors;
it is not a crash/power-loss recovery journal or an atomic snapshot for concurrent
readers/writers.

Dry-run prints the proposed full file contents and creates nothing. Review locally:
existing config may contain private settings. Init does not alter project trust,
global Codex preferences, scripts, contracts, generated assets, `.gitignore` or
report files. No Codex skill installation is necessary; shared guidance remains in
`resources/agent-workflow`, while project-specific instructions stay in the template.

The generated TOML is machine-local. Keep it out of shared commits where possible;
if your project already tracks config, review its local-path handling explicitly.
Commit `AGENTS.md` and use the shipped
`resources/agent-workflow/codex.config.toml.example` as a safe tracked placeholder
example. After moving a checkout, changing Node or reinstalling the package, review
conflicting paths manually and rerun init. No `${workspaceFolder}` interpolation is
used in Codex TOML. That interpolation belongs only to the separate
`resources/agent-workflow/vscode.mcp.json.example` for VS Code/Copilot; a Copilot
entry does not configure the Codex extension.

## Doctor and native Codex invocation

`pagestudio doctor [--project-root <directory>] [--config <existing-dev-config>]
[--json]` is read-only except for launching and closing its own diagnostic stdio MCP
process. It never installs packages, starts a dev owner, builds assets, syncs
contracts or changes trust. Its Node/dependency check covers declared package
resolution; the protocol probe additionally exercises the MCP runtime imports.
It deliberately validates the PageStudio entry against the Node/package installation
running doctor, avoiding execution of arbitrary project-configured commands.

| Check | Meaning and fix |
| --- | --- |
| PASS | The named local check succeeded; it is not blanket adoption or visual approval. |
| WARN | Nonblocking local condition: missing/stopped/dead owner, an owner still building, transient status publication, contract override, or HTML-only asset scope. Reuse/start the existing workflow and rerun when ready. |
| FAIL | Blocking setup/readiness problem: unsupported Node, missing dependency/config/executable, conflicting roots/tools, missing/invalid contracts, stale/invalid/failed owner or mismatched scope, invalid dev config, failed MCP protocol/tool discovery. Resolve the specific message. |
| NOT_VERIFIED | Evidence unavailable: live Codex config loading, native invocation, browser appearance, or an owner scope/protocol check prevented by another failure. |

Exit status is **1 if any check FAILs**, otherwise **0**. Exit 0 can include WARN
and NOT_VERIFIED; a stopped owner is an expected setup state, never a ready build.
The report includes canonical root, configured asset inputs, and live
session/generation when available. `--config` should match the existing start script;
CLI overrides/custom watch scopes still need source inspection because status does
not publish the full owner configuration. HTML-only readiness cannot verify an
asset change. Manifest/schema validity cannot independently prove CMS provenance.
Obtain the real CMS `tools:blocks:export` output and use the existing
`contracts sync --from` command; do not create fixtures to make doctor pass.

Doctor initializes stdio, lists the three required tools and calls build status
with a bounded timeout. It labels this as a **diagnostic protocol probe**. It does
not claim the VS Code session loaded config, read AGENTS.md, or invoked native tools.

After init, reload the VS Code window and start a **new Codex session in the template
project**. Project-local configuration is loaded for trusted projects only; the
developer manages that trust decision. Ask Codex to identify its instruction sources,
then use Codex's connected-tools picker/discovery to find the tools below. Ask it to
invoke build status directly, retrieve an applicable CMS block contract, and validate
each affected project-relative layout. Record actual native calls; a shell command,
SDK probe or a successful doctor report is not native tool-picker evidence. No
`codex mcp` command or Codex CLI installation is needed.

Configuration fields and project scope were checked against the
[official OpenAI MCP documentation](https://developers.openai.com/codex/mcp) and
[configuration precedence/trust documentation](https://developers.openai.com/codex/config-basic).

Use the connected client's tool-discovery/list-tools facility and verify the actual
names (prefixes may vary):

| Tool | Input | Purpose |
| --- | --- | --- |
| pagestudio_get_block_contract | `{ "name": "button" }` | Authoritative enabled block settings/input/rendered fixture |
| pagestudio_get_build_status | `{}` | Current project owner, readiness, session and generation |
| pagestudio_validate_template | `{ "file": "relative/layout.html" }` | Read-only source and existing CSS diagnostics with coverage limitations |

Retrieve applicable contracts before editing. Tool presence does not imply contracts
exist or a dev owner is live. A local Node import of validateTemplate is not evidence
of an MCP call. A diagnostic SDK stdio connection can test the MCP protocol, but must
be labeled separately from native agent tool-picker discovery; do not claim one
proves the other. Missing native tools remain an adoption gap even if transport works.

## Verification protocol

Make the bounded source change with the existing design system and CMS structure.
Inventory every affected HTML template, including consumers of edited partials or
shared styles. For each whole batch:

1. Read status until available/ready/state=ready for the intended project and asset
   scope. Idle/building means wait. Persistent unavailable/stale/stopped is not success;
   a transient `updating` publication can be retried briefly. Failed means inspect the
   terminal and fix source; configuration changes require restarting the dev owner.
2. Record projectRoot, sessionId and generation. Validate **every affected template**
   by project-relative path, preserving valid, findings and limitations.
3. Read status again. Accept this batch only if both reads are available/ready,
   projectRoot/sessionId match, and generation is identical. Changed sessions or
   generations invalidate the entire batch, not just the last file. Wait and repeat.
4. Address actionable errors/risks in source. Any fix/rebuild requires repeating
   the batch. Explain intentional warnings with source evidence, and leave unresolved
   risks visible. Valid=true can include warnings and does not prove full compatibility.
5. Report the files/contracts/tools, both status checkpoints, results, fixes,
   retained diagnostics, unsupported coverage and actual browser verification status.

Start from `resources/agent-workflow/verification-report.md`. It is an unexecuted
report template, never a success artifact. Build success, stable static validation,
native client discovery and browser verification are four distinct claims.

## Troubleshooting

| Observation | Response |
| --- | --- |
| Client has no PageStudio tools | Check the client-specific config, actual package path/capabilities, trusted-project rules and enabled tools; restart/reconnect. Keep native discovery unverified until observed. |
| Native CLI says no server but explicit config works | Project config was not loaded in that invocation; trust/client scope is a possible cause. Record the error; do not silently edit global trust. |
| unavailable/missing/stopped/stale | Confirm projectRoot and intended owner. Use developer setup/start/restart. Do not validate old CSS as current success. |
| failed | Inspect dev terminal; status deliberately omits raw child errors. Fix source and wait, or restart for configuration changes. |
| HTML-only readiness after CSS changes | Configure the existing asset script/watch scope; HTML-only status is insufficient. |
| Missing/invalid/unknown block contract | Sync a verified export through setup, check enabled name and root/override. Record incomplete coverage; never invent a CMS rule. |
| Tool call returns isError | Preserve the error and resolve it; do not count it as a validation result. |
| Warnings or unmatched selectors | Inspect rule evidence and finite fixture/ancestor limits. Fix unintended effects; document intentional patterns and unresolved risks without suppressing diagnostics. |
| Source-map/stale-asset limitations | Keep generated attribution and freshness caveats visible. Readiness proves command completion, not every dependency or source-map interpretation. |
| Session/generation changes after validation | Discard all results in that attempt and revalidate every affected template after ready. |

## Manual live-agent checklist

- [ ] Record repository/commit, working changes and inspected source/build conventions.
- [ ] Confirm AGENTS.md was loaded by the native agent in the intended project.
- [ ] Discover all three MCP tools; record client and actual transport. Distinguish
      native discovery from a diagnostic fallback and keep missing checks unchecked.
- [ ] Read contracts/fixtures for all applicable blocks **before** source edits.
- [ ] Use one already-running owner. If setup had to start it, record that separately
      and reuse that exact session for the task; never start a second builder.
- [ ] Implement a bounded component change and enumerate affected templates.
- [ ] Observe waiting for ready and record projectRoot/scope/session/generation.
- [ ] Validate every affected template; classify/fix findings and retain limitations.
- [ ] Record a second ready checkpoint with identical session/generation.
- [ ] Demonstrate that an intervening edit invalidates an attempt and that the next
      attempt revalidates every affected template. Preserve the rejected attempt.
- [ ] Report browser appearance as NOT CHECKED unless actually rendered/inspected.
- [ ] Separate reusable package artifacts from template changes and its live evidence.

## Adoption acceptance and evidence

A second repository is adopted when its adapted guidance/config discovers all tools,
contracts resolve, its existing owner reports the correct project and asset scope,
a bounded change rebuilds, and the full protocol/report can be repeated without
Gourmet-specific paths. Automated resource/MCP checks test executable configuration
and protocol behavior; they cannot prove an agent reads or obeys prose.

The Gourmet exercise has its source change and observed evidence in a separate
Gourmet branch/PR. Native client limitations must remain explicit rather than
being converted into an all-green checklist. The generic package includes no
client-specific demonstration content or fabricated example success values.

Observed example: [Gourmet's report](https://github.com/pagestudiocms/gourmet-template/blob/feat/agent-hero-verification/docs/agent-hero-evidence/README.md)
and [machine evidence](https://github.com/pagestudiocms/gourmet-template/blob/feat/agent-hero-verification/docs/agent-hero-evidence/run.json).
The run rejected generation 7→8, then validated all 16 layouts at one ready
generation 8. Baseline warnings remained visible. Native project-config/tool-picker
discovery and browser appearance were not verified; the report preserves those gaps.

Verification for this package change: all **109 tests pass with none pending**,
with the 17-block local CMS bundle enabled. Six new checks cover npm resource
inclusion, client configuration/guidance consistency and real stdio MCP protocol
behavior in a non-Gourmet project. These tests do not claim native-agent obedience
or browser correctness. The accepted Gourmet generation remains historical evidence
after its isolated setup owner is stopped.

## Native Codex VS Code follow-up (November 11, 2026)

The earlier isolated Gourmet demonstration did **not** verify native Codex
tool-picker discovery. A subsequent, separate user-observed Codex VS Code
session reported direct calls to all three connected PageStudio MCP tools,
without shell/Node.js substitution. The `button` contract returned
`Button_Portlet` and its rendered fixture; build status was ready at
session `6dbe483b-2261-4243-82a3-133092b1a426`, generation 1.
`src/html/layouts/components.html` validated `valid=true`, and the
ready session/generation were unchanged afterward.

Codex then reported adding `border-radius: 4px` to
`.aas-theme-showcase__swatch` in Gourmet's
`src/scss/components/_aas-theme-showcase.scss`. The existing owner
reported ready generation 2 in the same session; the validator attributed
the compiled declaration to that SCSS rule and returned `valid=true`
for `components.html`. A final status check remained ready at generation
2 with no pending changes.

This is **reported native-client integration evidence**, not an automated
package test or independently captured raw tool trace. It resolves the
native invocation gap for that local Codex VS Code configuration, while
preserving the historical failed project-file lookup in the earlier run.
The follow-up retained 21 findings (1 `PS-ASSET-002`, 5 `PS-CSS-101`,
13 `PS-RESP-002`, 2 informational `PS-CSS-102`). The asset-freshness
warning and browser/visual checks remain open. Only `components.html` was
reported validated after the SCSS edit; this follow-up alone does not
demonstrate a whole-affected-layout validation batch.

See the separate [Gourmet follow-up report](https://github.com/pagestudiocms/gourmet-template/blob/feat/agent-hero-verification/docs/agent-hero-evidence/README.md).

## Reusable kit implementation and second-template evidence (issue #15)

See [design/audit decisions](kit-design.md) and the
[second-template adoption report](second-template-adoption.md) for actual automated
observations and outstanding native VS Code checks. The new kit has 38 targeted
checks for merges, reruns, paths, dry-run, conflicts, dependency/config/contract
failures, owner readiness, real stdio behavior, rollback and customized guidance
preservation. The full suite passes **147
checks with none pending**, including the verified 17-block local CMS export.
The disposable independent template accepted both affected layouts in one ready
session at generation 3 after advancing from generation 1. This is diagnostic SDK
evidence; native VS Code invocation remains a manual gap.
