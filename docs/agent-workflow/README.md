# MCP-guided template development

Use this workflow in a PageStudio **template repository**. It combines the existing
CMS fixture contracts, read-only validator and running dev owner's build status.
It adds no compiler, agent control plane, browser automation or build execution
inside MCP. Paths come from the adopting project rather than a Gourmet convention.

## Adopt in another template

1. Install/link a development-server package exposing all three tools below. Tool
   discovery is required: an unchanged package version string is not capability proof.
2. Inspect package scripts, site/build configuration and source conventions. Resolve
   the actual layouts, partials, data, CSS/SCSS/JS inputs and emitted asset paths.
3. Copy `resources/agent-workflow/AGENTS.md` from this package to the template root.
   If guidance already exists, merge the workflow without overwriting local rules.
   Commit the adapted instructions in the template repository. The package resource
   remains the reusable distribution source; it does not prescribe template paths.
4. Obtain a verified CMS export and run the existing `pagestudio contracts sync
   --from /path/to/export` setup command in the template root. Runtime MCP remains
   read-only; it does not export, download or silently invent contracts.
5. Configure the MCP client to launch this package's `bin/pagestudio-mcp.js`, with
   PAGESTUDIO_PROJECT_ROOT set to the template root. The package can live elsewhere.
   Project-local `.pagestudio/contracts` is the default. Set
   PAGESTUDIO_BLOCK_CONTRACTS_DIR only to intentionally select another verified bundle.
6. Have the developer start the project's existing `npm run start` workflow once.
   Reuse that owner; do not start competing Grunt/Webpack/build/watch commands.
7. Enable the MCP server/tools in the client and perform discovery plus a readiness
   call before accepting the setup. Readiness must identify the intended canonical
   projectRoot and cover assets when the requested change affects assets.

The examples under `resources/agent-workflow` are shipped with the npm package.
They are mergeable examples, not an installer that changes client preferences.
Keep contracts, live owner/status files and temporary evidence out of commits
unless explicitly curating sanitized evidence in a report.

## MCP configuration and discovery

For Codex, merge `codex.config.toml.example` into the template's
`.codex/config.toml` (or adapt it to user configuration), replacing every absolute
path. Codex documents project configuration as trusted-project only. Do not alter
trust settings automatically. The example uses supported stdio command, args, cwd
and env fields. Confirm the configured server with `codex mcp get pagestudio --json`
or `codex mcp list`; this proves configuration recognition, **not tools usage**.
See the [official OpenAI MCP documentation](https://developers.openai.com/codex/mcp).

For VS Code/Copilot, merge `vscode.mcp.json.example` into `.vscode/mcp.json`.
Only that client example uses `${workspaceFolder}`. Do not copy its interpolation
syntax into Codex TOML. Other clients must use their own documented stdio schema.
A VS Code MCP entry alone does not configure a different agent client.

Place the copied AGENTS.md at the adopting template root and start the agent from
that project. Codex documents reading repository guidance at session startup;
restart a session after adding instructions and ask it to identify its instruction
sources. See the [official OpenAI AGENTS.md documentation](https://developers.openai.com/codex/guides/agents-md).

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
