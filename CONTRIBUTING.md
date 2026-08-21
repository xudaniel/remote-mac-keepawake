# Contributing

Thank you for improving Remote Mac KeepAwake. Changes must preserve the
project's fail-closed behavior, local-first defaults, and explicit safety
boundaries.

## Clean checkout

Use a standalone clone. The repository root must be the directory returned by
`git rev-parse --show-toplevel`, and `dashboard/` must not contain a nested
`.git` directory.

```bash
git clone https://github.com/xudaniel/remote-mac-keepawake.git
cd remote-mac-keepawake
git switch -c your-name/short-change-description
git remote -v
git status --short --branch
```

Do not develop from a parent repository that contains unrelated documents or
private files. Never stage an entire mixed worktree.

## Local verification

Run the shell suites on macOS:

```bash
bash -n bin/remote-mac-keepawake bin/remote-mac-heartbeat \
  tests/test.sh tests/docs-test.sh tests/heartbeat-test.sh
./tests/test.sh
./tests/docs-test.sh
./tests/heartbeat-test.sh
```

Run the dashboard suite with Node.js 22.13 or later:

```bash
cd dashboard
npm ci
npm audit --audit-level=moderate
npm run lint
npm test
```

Hosted CI remains authoritative for ShellCheck and the supported macOS runner
matrix.

For a dashboard schema change, add the next sequential SQL file under
`dashboard/drizzle/`, update `dashboard/db/schema.ts`, and extend
`dashboard/tests/migrations.test.mjs`. Migrations must be additive unless a
separate, tested recovery plan is part of the pull request. A schema-generator
CLI is deliberately not installed, which keeps the development dependency
surface smaller and makes the reviewed SQL the source of truth.

## Pull requests

- Keep one reviewable purpose per pull request.
- Describe user impact, safety boundaries, rollback behavior, and validation.
- Update both English and Simplified Chinese documentation when behavior or
  operator guidance changes.
- Keep secrets and production telemetry out of commits, fixtures, screenshots,
  logs, issues, and pull-request comments.
- Use synthetic values for public examples and visual assets.
- Do not weaken authentication, FileVault guidance, or physical-recovery
  warnings to simplify a demo.

## Private information

Do not publish tokens, webhook URLs, hostnames, usernames, IP addresses, serial
numbers, locations, real heartbeat history, or screenshots of the private
dashboard. Sanitize diagnostic output before attaching it to an issue.

Report vulnerabilities through GitHub private vulnerability reporting rather
than a public issue.
