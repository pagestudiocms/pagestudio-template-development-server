# PageStudio template development

Use this repository's existing design system, CMS conventions and asset pipeline.
Before editing HTML, SCSS or JS, inspect package scripts, build/configuration files,
applicable template/data/partial files, imported styles and nearby components.
Resolve source/output paths from this project; do not assume a Gourmet layout.
Preserve unrelated work. Keep the requested change bounded.

Discover these tools from the configured PageStudio MCP server (client prefixes
may differ):

- pagestudio_get_block_contract({name})
- pagestudio_get_build_status({})
- pagestudio_validate_template({file})

Retrieve each applicable CMS block contract and rendered fixture before editing.
Preserve its supported structure/classes and distinguish sample markup from all
possible CMS output. Missing/invalid contracts are a coverage gap: report the
missing block/bundle, arrange a validated export, and avoid inventing CMS rules.

Use the existing running dev owner. Do not start competing npm/Grunt/Webpack/watch
processes, run builds from MCP, or treat old compiled assets as current. When no
dev owner is available, report it and use the developer's setup/start workflow;
resume verification once the intended owner is running. Check projectRoot and
assetBuild scope; HTML-only readiness cannot attest an asset change.

After the source change, follow this verification protocol for ALL affected
HTML templates, including layouts consuming changed partials/styles:

1. Call pagestudio_get_build_status. Wait for available=true, ready=true,
   state=ready in the intended project. Idle/building means wait and recheck;
   unavailable/stale/stopped is NOT success. Retry a transient updating publication
   briefly; persistent unavailable status needs developer setup. On failed, inspect the dev terminal,
   fix actionable source errors and wait again. Configuration changes need restart.
2. Record sessionId and generation. Call pagestudio_validate_template for each
   affected project-relative HTML file. Inspect valid, findings AND limitations.
   Fix actionable errors/risks in source, then restart this protocol after rebuild.
3. Read build status AGAIN. Accept results only when available and ready are
   still true, projectRoot and sessionId match, and generation is unchanged for
   the entire validation batch. A changed session/generation invalidates ALL
   findings in that batch; wait and repeat every affected template.
4. Classify warnings individually: fix unintended risks, explain intentional
   overrides with evidence, and explicitly retain unresolved risks/coverage gaps.
   Do not suppress warnings merely to obtain a clean report. Unmatched selectors
   and missing fixture ancestors are not proof of invalid CSS.
5. Report affected files, contracts, tools/transport actually used, build
   sessionId/generation before and after, each validation result, fixes, retained
   findings and limitations. State whether browser appearance was actually checked.

If MCP is absent/disconnected or tools are missing, diagnose configuration,
project root, package version and client tool enablement. Report verification as
blocked/unverified until connected; local compilation or direct validator imports
are not a substitute for an MCP run. A diagnostic stdio client may demonstrate
protocol behavior when native client discovery is unavailable, but label that
transport and leave native-agent discovery unverified.

Static MCP results do NOT prove visual correctness, browser responsive behavior,
accessibility conformance, complete CMS rendering or tenant compatibility. Never
claim those checks unless actually performed. Keep browser verification separate
from build and static validation in the final report.
