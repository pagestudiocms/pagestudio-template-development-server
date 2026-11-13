# Second template adoption exercise — November 13, 2026

The exercise passed in a **new, clean, independent non-Gourmet template Git
repository**, created in a temporary directory with spaces in its path. It is a
minimal template fixture, not adoption of another production theme. No original
theme working files were changed. Native Codex VS Code invocation remains
**NOT_VERIFIED**; browser appearance is **NOT_CHECKED**.

## Automated observations

The reproducible [exercise script](../../scripts/verify-agent-kit-adoption.js)
creates the repository, configures its existing one-shot Sass pipeline, and starts
one `npm run start` owner **before initialization**. Init and doctor reuse that
owner. The script shuts down its own owner and removes the temporary repository.
This setup owner is explicit test setup, not a side effect of init/doctor/MCP.

- Sources use `views/pages`, `views/includes`, `content`, and `theme`; output uses
  `public`. These paths are configured, not inferred from Gourmet conventions.
- The repository was clean after its initial commit. Init dry-run created nothing;
  init created guidance/config; rerunning reported both files unchanged.
- The verified local CMS `tools:blocks:export` bundle was installed through the
  existing `contracts sync --from` CLI, yielding **17 valid enabled blocks**. The
  export came from the local platform's `src/var/tmp` output, not generated test
  contracts. Its manifest SHA-256 is retained in the machine evidence. Contract
  validity alone is not independent proof of provenance.
- Doctor exited 0 with PASS for Node/dependencies, root, Codex config/executable,
  contracts, dev configuration, ready owner, asset scope and the diagnostic MCP
  protocol/tools. Live Codex config, native invocation and browser checks stayed
  NOT_VERIFIED.
- A separate SDK stdio client discovered all three PageStudio tools and retrieved
  the real `button` contract before editing. This is diagnostic transport evidence,
  **not a native VS Code tool-picker invocation**.
- A bounded change updated the shared banner partial text and button radius in
  `theme/main.scss` from `.25rem` to `.375rem`. Both `index` and `contact` layouts
  consume those sources. Actual compiled HTML contained the updated partial.
- The same owner advanced from ready **generation 1 to generation 3**. Two observed
  source edits can produce multiple generations; this is not assumed to be 1→2.
- Both affected layouts validated with `valid=true`, **zero findings**, and **13
  limitations each**. Before/after status remained ready in the same root/session
  at generation 3. The batch was accepted. Source maps and compiled CSS were
  inspected by the existing validator; the full responses retain attribution and
  freshness limitations, including that freshness is not proven.
- After explicit shutdown, status was unavailable with reason `stopped`, confirming
  the historical accepted generation is not presented as live readiness.

[Machine evidence](second-template-evidence.json) contains the actual tool list,
contract response, status checkpoints, doctor report and full per-layout diagnostics.
Machine-specific paths are replaced by `<template-root>`, `<development-server>`,
`<verified-cms-export>` and `<node>`; session/generation values are actual observations.

## Reproduce

From a checkout with dependencies installed, on POSIX:

```sh
node scripts/verify-agent-kit-adoption.js "/absolute/path/to/verified-cms-export" "/absolute/path/to/evidence.json"
```

This is an explicit test command that starts a disposable dev owner. It is separate
from the read-only doctor and from the recommended workflow of reusing a project's
already-running owner. No CMS export is created or downloaded by the script.

## Outstanding manual adoption

- [ ] Open the initialized second project in the Codex VS Code extension, reload the
      window and begin a new session; verify its project config and AGENTS.md load.
- [ ] Discover all three tools through native Codex and record direct contract,
      build-status and per-layout validation calls around a stable ready generation.
- [ ] Repeat in a full production theme if broader migration evidence is needed.
- [ ] Windows installation/adoption and browser appearance were not tested.

The temporary project was removed, so a native follow-up must recreate an adopting
project using the documented init flow. Do not turn the diagnostic SDK evidence
into a claim of native discovery, agent obedience or rendered correctness.

## Package checks

The full suite passes **139 tests with none pending**, including 30 new kit checks
and all 17 real CMS blocks. An actual `npm pack --ignore-scripts` artifact was
opened and checked for both CLI scripts, all three new command modules, and the
four reusable workflow resources. `git diff --check` passes.
