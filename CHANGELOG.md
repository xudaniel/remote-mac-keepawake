# Changelog

All notable changes follow semantic versioning.

## [Unreleased]

### Added

- A bilingual, mobile-first GitHub Pages live viewer with an explicit synthetic
  demo mode, exact-timestamp battery and network history, installable PWA
  metadata, and a one-minute refresh loop aligned with the heartbeat cadence.
- Optional read-only connection to an operator-authorized Mac Pulse API. Viewer
  credentials remain in per-tab `sessionStorage`; a strict configured-origin
  CORS policy exposes only status and history reads.

### Security

- The public viewer contains no analytics or third-party runtime assets, never
  accepts the heartbeat ingest/signing key, and does not put credentials in a
  URL or persistent browser storage.

## [1.4.0] - 2026-08-22

### Added

- HMAC-SHA-256 heartbeat signing with key IDs, replay protection, authentication
  rate limiting, and current/next/previous key-rotation slots.
- Autonomous one-minute offline monitoring with a D1 execution lease,
  persistent bounded retries, fallback webhook delivery, and an optional
  scheduler canary.
- Read-only battery condition, cycle count, design/full-charge capacity,
  estimated battery health, and macOS thermal-pressure history.
- Opt-in cached network diagnostics for local route, gateway, DNS, public HTTPS,
  dashboard ingest, latency, jitter, packet loss, fault category, and exact
  measurement time without retaining network identifiers.
- A verified `upgrade --release latest|VERSION` workflow with checksum and
  archive-path validation, coordinated KeepAwake/reporter rollback, and explicit
  downgrade protection.

### Changed

- Alert history now exposes delivery attempts, target, retry schedule, final
  delivery time, and scheduler health in the bilingual dashboard.
- History and CSV export retain the new hardware and network fields for the same
  owner-controlled lifetime as existing heartbeat samples.
- Release archives now include bilingual architecture and version-specific
  release notes in addition to both CLIs, PRDs, and the full dashboard source.

### Security

- Production heartbeat ingestion fails closed on missing or invalid signatures
  unless a time-bounded legacy-bearer migration flag is explicitly enabled.
- Signing tokens, key IDs, caches, and diagnostic configuration remain in
  mode-`0600` files inside a mode-`0700` directory.

## [1.3.0] - 2026-08-21

### Added

- Mac Pulse, an optional bilingual remote monitoring dashboard with protected
  heartbeat ingestion, 90-second offline detection, and retained D1 history.
- A privacy-preserving launchd heartbeat reporter that runs every 60 seconds
  and never uploads machine identity.
- Opt-in remote-Mac internet speed sampling with cached download, upload, idle
  latency, responsiveness, exact measurement timestamps, retained history, and
  CSV export. Apple `networkQuality` runs no more often than every 30 minutes
  and defaults to every 6 hours to limit bandwidth impact.
- A private, atomic heartbeat outbox with bounded network retries, automatic
  recovery replay, concurrency locking, queue diagnostics, and uninstall-safe
  preservation of unsent samples.
- Random sample IDs and idempotent ingestion so ambiguous network retries do
  not duplicate retained history.

### Changed

- CI now validates both Bash executables, all shell suites, the dashboard
  build and lint, and additive D1 migrations without duplicate branch runs.
- Release archives now align CLI, heartbeat, and dashboard versions and
  include the complete dashboard source and migrations.
- Dashboard build dependencies are refreshed, the audited dependency tree has
  no known vulnerabilities, and CI rejects moderate-or-higher npm advisories.
- D1 migrations use reviewed sequential SQL plus a legacy-data migration test,
  avoiding an unnecessary vulnerable schema-generator dependency.

### Fixed

- Replayed heartbeat history now uses the Mac's original observation time and
  does not emit stale historical alerts.
- Battery state parsing now distinguishes `not charging` from `charging` and
  normalizes malformed sensor values before emitting JSON.

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
