# Changelog

All notable changes follow semantic versioning.

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
