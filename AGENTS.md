# AGENTS.md

This file provides repository-specific guidance for future coding sessions.

## Purpose

This repository implements a GitHub Action that installs `inspequte`, adds it to
`PATH`, and reuses GitHub Actions tool-cache entries when available.

## Key Behavior to Preserve

- Action input:
  - `version` (optional)
- Action output:
  - `version` (installed release tag, e.g. `inspequte-v0.13.0`)
- If `version` is omitted:
  - select the newest stable release that includes a downloadable asset for the
    current runner target
- If `version` is provided:
  - accept `0.x.y`, `v0.x.y`, or `inspequte-v0.x.y`
- Must add installed tool directory to `PATH`
- Must use `@actions/tool-cache` (`find` + `cacheDir`) for reuse

## Supported Runner Targets

- `linux/x64` -> `x86_64-unknown-linux-gnu` (`tar.gz`)
- `darwin/arm64` -> `aarch64-apple-darwin` (`tar.gz`)
- `win32/x64` -> `x86_64-pc-windows-msvc` (`zip`)

If target is unsupported, fail with a clear error.

## Important Files

- `/Users/toda_k/ghq/github.com/KengoTODA/setup-inspequte/src/main.ts`
  - core implementation
- `/Users/toda_k/ghq/github.com/KengoTODA/setup-inspequte/action.yml`
  - action interface
- `/Users/toda_k/ghq/github.com/KengoTODA/setup-inspequte/__tests__/main.test.ts`
  - behavior tests for setup/version/cache logic
- `/Users/toda_k/ghq/github.com/KengoTODA/setup-inspequte/dist/index.js`
  - bundled runtime shipped to users

## Development Workflow

1. Install dependencies:
   - `npm ci`
1. Validate formatting/lint/tests:
   - `npm run format:check`
   - `npm run lint`
   - `npm run ci-test`
1. Rebuild distributable:
   - `npm run package`
1. Ensure `dist/` is updated when source changes.

## Environment Notes

- `.node-version` pins Node `24.4.0`.
- If local `nodenv` does not have that version, a practical fallback is:
  - `NODENV_VERSION=system npm ci`

## Change Guardrails

- Keep `README.md` usage examples aligned with `action.yml`.
- Keep tests aligned with release/tag naming conventions used by `inspequte`.
- Do not remove caching behavior.
- Do not manually edit `dist/`; always regenerate via `npm run package`.
