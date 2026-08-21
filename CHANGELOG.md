# Changelog

All notable changes follow semantic versioning.

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
