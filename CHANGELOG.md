# Changelog

All notable changes follow semantic versioning.

## [Unreleased]

## [1.3.0] - 2026-08-21

### Added

- Mac Pulse, an optional bilingual remote monitoring dashboard with protected
  heartbeat ingestion, 90-second offline detection, and bounded D1 history.
- A privacy-preserving launchd heartbeat reporter that runs every 60 seconds
  and never uploads machine identity.
- Opt-in remote-Mac internet speed sampling with cached download, upload, idle
  latency, responsiveness, exact measurement timestamps, retained history, and
  CSV export. Apple `networkQuality` runs no more often than every 30 minutes
  and defaults to every 6 hours to limit bandwidth impact.

### Changed

- CI now validates both Bash executables, all shell suites, the dashboard
  build and lint, and additive D1 migrations without duplicate branch runs.
- Release archives now align CLI, heartbeat, and dashboard versions and
  include the complete dashboard source and migrations.
- Dashboard build dependencies are refreshed, the audited dependency tree has
  no known vulnerabilities, and CI rejects moderate-or-higher npm advisories.
- D1 migrations use reviewed sequential SQL plus a legacy-data migration test,
  avoiding an unnecessary vulnerable schema-generator dependency.

## [1.2.0] - 2026-08-20

### Added

- A standalone English product requirements document at `docs/PRD.en.md`.
- A complete Simplified Chinese product requirements document at
  `docs/PRD.zh-CN.md`.
- A dedicated Chinese README at `README.zh-CN.md` with parity links between
  both languages.
- Automated documentation checks that keep the CLI version, changelog,
  bilingual README files, PRDs, and release archive aligned.

### Changed

- Reorganized the English README around installation, operational safety,
  health monitoring, recovery, and release verification.
- Release archives now include both README files and both PRDs.

## [1.1.0] - 2026-08-20

### Added

- Fail-closed install, start, restart, and atomic rollback behavior.
- Postcondition verification against launchd state, managed PID, and `pmset`
  sleep assertions.
- Atomic `migrate --system --yes`, `upgrade`, `self-test`, and
  `recovery-check --system` workflows.
- Stable user and system CLI installation paths.
- Privacy-preserving JSON health checks, bounded watch logs, optional local
  notifications, and minimal HTTPS webhooks.
- Failure-injection tests, supported macOS runner matrix, real launchd restart
  integration test, pinned CI dependencies, and checksum releases.

### Changed

- Uninstall now reports exact removed paths and preserves logs.
- Network and Chrome Remote Desktop checks are explicitly opt-in.

## [1.0.0] - 2026-08-20

- Initial user/system launchd manager for macOS `caffeinate -i`.
