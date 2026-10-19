# Dependency audit remediation — 2026-10-19

Base: `7178ca68f4a3e6f0121da85bfd8a198bc3d72a64` (main).
Related: Dependabot PRs #43 and #44; failed CI run 39155371107.

## Changes

No direct dependency versions or security gates are changed.

| Dependency | Before | After | Dependency path |
| --- | --- | --- | --- |
| brace-expansion | 1.1.18 / 5.0.9 | 1.1.21 / 5.0.12 | minimatch; typescript-eslint → typescript-estree → minimatch |
| source-map-js | 1.2.1 | 1.2.2 | Vite / Tailwind → PostCSS; Tailwind node |
| fast-uri | 3.1.5 | 3.1.8 | react-server-dom-webpack → webpack → schema-utils → AJV 8 |
| js-yaml | 4.3.1 | 4.3.2 | ESLint configuration |
| sharp | 0.35.2 | 0.35.5 | Cloudflare Vite plugin / Wrangler → Miniflare |
| undici | 7.29.0 | 7.30.0 | Cloudflare Vite plugin / Wrangler → Miniflare |

The first four updates stay within existing dependency ranges and include both
Dependabot fixes. Miniflare pins sharp and undici exactly, so overrides are scoped
to `miniflare@5.20260820.0-alpha`. They retain the sharp 0.35 line and undici 7
major. Remove these overrides when upgrading to an upstream Miniflare release
that declares safe versions, and re-run the full build and runtime tests.

## Remaining blocker — do not merge yet

Full audit still exits 1: **7 high-severity affected packages**, all from
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
These are not seven independent root vulnerabilities.

Paths:

- `@next/eslint-plugin-next@16.3.2 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`
- `vinext@1.0.0-beta.8 → vite-plugin-commonjs@0.10.4 → vite-plugin-dynamic-import@1.6.0 → fast-glob@3.3.3 → micromatch@4.0.8 → braces@3.0.3`

The registry's latest braces version is still 3.0.3; the advisory marks `*`
affected. Deeply nested malicious brace patterns can exhaust the process stack
and deny service. These paths belong to development/build tooling. No direct
application import was found in app, worker, or lib, but this does not prove all
production or build inputs are safe. Untrusted source, patterns, or build inputs
remain relevant exposure.

`npm audit fix --force` proposes downgrading the Next ESLint plugin to 14.2.35
and vinext to 0.0.15. This would change the lint/framework compatibility surface
and is not an acceptable minimal repair. No audit exceptions, severity changes,
production-only audit substitution, or forced downgrades are introduced.

Before merging, obtain a published upstream fix (or separately review and test
a compatible replacement), refresh the lockfile, and require the full audit and
all CI checks to pass. PRs #43 and #44 remain open; their patches alone do not
resolve the full audit.

## Validation

- Node 22.13.0 / npm 10.9.2, matching CI: build and all 18 dashboard tests pass,
  including rendered HTML, heartbeat authentication, CORS, and additive D1 migrations.
- ESLint passes.
- A separate smoke check passed a PNG encode/decode through sharp 0.35.5 and a
  local Miniflare worker request with undici 7.30.0.
- Full audit reduced from the original CI's 15 high findings to 7, but still fails.
- macOS-only integration tests require GitHub Actions; no local macOS pass is claimed.

The patch is partial remediation, not a clean security bill of health.
