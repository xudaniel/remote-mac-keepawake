# Remote Mac KeepAwake

[![CI](https://github.com/xudaniel/remote-mac-keepawake/actions/workflows/ci.yml/badge.svg)](https://github.com/xudaniel/remote-mac-keepawake/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/xudaniel/remote-mac-keepawake)](https://github.com/xudaniel/remote-mac-keepawake/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-70eabb.svg)](LICENSE)
[![macOS](https://img.shields.io/badge/macOS-14%20%7C%2015%20%7C%2026-f1faf6.svg)](#supported-systems-and-ci)

[English](README.md) | [简体中文](README.zh-CN.md)  
[English PRD](docs/PRD.en.md) | [中文 PRD](docs/PRD.zh-CN.md)

Current release: v1.4.0

![Mac Pulse synthetic dashboard preview](docs/assets/mac-pulse-synthetic.svg)

The preview uses synthetic values only. See the
[architecture and trust boundaries](docs/ARCHITECTURE.md).

Remote Mac KeepAwake runs macOS's built-in `caffeinate -i` as a verified,
launchd-managed service. It prevents idle system sleep, restarts automatically,
and provides explicit health checks for remote administration.

The project is local-first:

- no third-party runtime or background server;
- no account or cloud service;
- no telemetry by default;
- no success message until launchd state, PID, and the sleep assertion are
  verified.

## Safety boundary

This tool prevents **idle system sleep** while the managed `caffeinate`
process is healthy. The display can still turn off normally.

No software can guarantee that a remote Mac is always reachable. This project
cannot overcome:

- a closed MacBook lid or depleted battery;
- charger, outlet, router, Wi-Fi, ISP, or hardware failure;
- a forced shutdown, kernel panic, or operating-system failure;
- the FileVault pre-boot unlock screen after a full restart.

If the Mac is already asleep or powered off, a GitHub repository cannot wake it
by itself. Keep a remote MacBook open, use reliable power and networking,
enable Wake for Network Access where appropriate, and maintain a second access
path.

## Quick start

Install in user mode without `sudo`:

```bash
git clone https://github.com/xudaniel/remote-mac-keepawake.git
cd remote-mac-keepawake
./bin/remote-mac-keepawake install --user
```

The stable command is installed at:

```text
$HOME/.local/bin/remote-mac-keepawake
```

Add it to your shell path if necessary:

```bash
export PATH="$HOME/.local/bin:$PATH"
remote-mac-keepawake status --user
```

A successful installation means all three postconditions passed:

1. the plist was installed and validated;
2. launchd reports the service as running with a managed PID;
3. `pmset -g assertions` confirms that PID prevents idle system sleep.

## Dedicated remote Mac: system mode

User mode starts after that user signs in. System mode starts during boot
without waiting for an interactive login and installs the CLI at:

```text
/usr/local/bin/remote-mac-keepawake
```

Safely migrate an existing user installation:

```bash
sudo "$HOME/.local/bin/remote-mac-keepawake" migrate --system --yes
sudo /usr/local/bin/remote-mac-keepawake recovery-check --system
```

Migration leaves the working user service active until the system LaunchDaemon
passes ownership, file-mode, plist, launch-domain, PID, and assertion checks.
If system activation fails, the user installation remains available.

Perform this only when physical recovery is available. If FileVault is enabled,
remote software cannot pass the pre-boot unlock screen after a full restart.

## Command reference

After installation, commands work from any directory:

```bash
remote-mac-keepawake status
remote-mac-keepawake status --json
remote-mac-keepawake status --watch --interval 30
remote-mac-keepawake health --json
remote-mac-keepawake restart
remote-mac-keepawake self-test
remote-mac-keepawake doctor
remote-mac-keepawake logs
```

Temporarily allow normal idle sleep:

```bash
remote-mac-keepawake stop
```

Resume protection and verify it:

```bash
remote-mac-keepawake start
```

## Health diagnostics

`health` returns stable JSON fields and script-friendly exit codes:

| Exit code | State | Meaning |
| --- | --- | --- |
| `0` | healthy | Service, PID, and assertion are valid. |
| `1` | unavailable | The service, PID, or assertion is missing. |
| `2` | degraded | An explicitly checked dependency is at risk. |

```bash
remote-mac-keepawake health --json
remote-mac-keepawake health --json --network --chrome
```

The default check stays local and reports:

- launchd mode and service state;
- managed PID and sleep assertion;
- power source, battery percentage, and charging state;
- battery condition, cycle count, design/full-charge capacity, estimated health,
  and macOS thermal-pressure state;
- MacBook lid state.

Optional checks:

- `--network` confirms a default route and makes an HTTPS HEAD request to
  Apple's captive-network success page.
- `--chrome` checks locally for the Chrome Remote Desktop host process.

Neither check runs by default.

## Continuous monitoring and alerts

Watch mode keeps only the latest 200 JSON records:

```bash
remote-mac-keepawake health --watch --interval 60
```

Optional state-change alerts:

```bash
remote-mac-keepawake health --watch --notify --interval 60
remote-mac-keepawake health --watch \
  --webhook https://example.com/remote-mac-health
```

Notifications and webhooks are opt-in. The webhook requires HTTPS and receives
only the service name, health state, and install mode. It does not receive the
hostname, username, PID, battery level, or secrets.

## Optional remote dashboard: Mac Pulse

The `dashboard/` app adds a private, mobile-friendly view of heartbeat
freshness, battery level, charging and power state, lid state, launchd service,
idle-sleep protection, version, remote-access diagnostics, alerts, and complete
retained history with exact local timestamps. An optional remote-Mac speed test
adds download, upload, idle latency, responsiveness, and its own exact timestamp.

Unlike a dashboard running only on the Mac, Mac Pulse stores a minimal opt-in
heartbeat outside the device. If no heartbeat arrives for 90 seconds, the
dashboard marks the Mac offline. This can indicate sleep, lost power, lost
network, shutdown, or another failure; it does not claim to identify which one.

After deploying the dashboard and receiving its private ingest token:

```bash
read -rs MAC_PULSE_INGEST_TOKEN
read -rs MAC_PULSE_SITES_TOKEN
printf '%s\n%s\n' "$MAC_PULSE_INGEST_TOKEN" "$MAC_PULSE_SITES_TOKEN" | \
  ./bin/remote-mac-heartbeat install \
  --url https://your-private-dashboard.example/api/heartbeat \
  --token-stdin --sites-token-stdin --key-id current --user \
  --network-diagnostics --internet-speed
unset MAC_PULSE_INGEST_TOKEN MAC_PULSE_SITES_TOKEN
./bin/remote-mac-heartbeat status
```

The reporter runs every 60 seconds. Every upload is HMAC-SHA-256 signed with a
key ID, transport timestamp, sample ID, and body digest; the server enforces a
five-minute replay window and rate-limits failed authentication without storing
source IP addresses. It does not send hostname, username, IP
address, serial number, location, or credentials. The production site uses its
owner-only identity session for viewing; its ingest key and private-site
automation token remain separate.

Rotate to a server-staged key without restarting the reporter:

```bash
read -rs MAC_PULSE_INGEST_TOKEN_NEXT
printf '%s\n' "$MAC_PULSE_INGEST_TOKEN_NEXT" | \
  ./bin/remote-mac-heartbeat rotate-key --key-id next --token-stdin
unset MAC_PULSE_INGEST_TOKEN_NEXT
```

Configure `INGEST_TOKEN_NEXT` with key ID `next` on the server first, rotate
the Mac, then promote the key. `INGEST_TOKEN_PREVIOUS` provides a bounded
rollback slot. Legacy bearer-only ingestion is disabled in production unless
`ALLOW_LEGACY_INGEST_BEARER=1` is deliberately set during migration.

Before each upload, the reporter atomically saves the sample in a mode-`0700`
private outbox. Transient failures use bounded retries; samples that still
cannot be delivered remain on disk and are replayed in observation-time order
after connectivity returns. Each sample has a random idempotency ID, so an
ambiguous retry cannot create duplicate history. `status` reports
`pending_samples` and `last_success_at`. Uninstall removes credentials but
preserves unsent samples for a later reinstall; a long outage can therefore
grow local disk use until delivery resumes.

`--internet-speed` uses Apple's built-in `networkQuality` on the remote Mac and
automatically enables privacy-preserving network diagnostics. The diagnostics
record only booleans, gateway latency/jitter/loss, a normalized fault category,
and an exact measurement timestamp—never gateway, DNS, SSID, public IP, or
endpoint identifiers. Enable them without a speed test using
`--network-diagnostics`; the default diagnostic interval is 300 seconds. Override
the local HTTPS reachability probe with a reviewed neutral endpoint using
`--network-probe-url HTTPS_URL`. Probe processes run at reduced CPU priority and
use strict timeouts. The 60-second heartbeat reuses a cached result; a new speed
test runs every 21,600 seconds
(6 hours) by default because each test transfers data and can briefly compete
with remote-control traffic. Set a reviewed interval from 1,800 to 86,400
seconds with `--speed-test-interval SECONDS`. Omit both flags to disable speed
testing completely.

Accepted samples are not automatically pruned. The owner can browse bounded,
cursor-paginated 1-hour through all-time or custom ranges, inspect exact local
timestamps and state changes, export CSV, see estimated storage and uptime, and
use an explicit confirmed deletion workflow. Retention remains subject to the
hosting provider's capacity and project lifecycle. Speed measurements and their
exact timestamps follow the same retention, export, and deletion lifecycle.
Replayed samples retain the time they were observed on the Mac rather than the
later time at which the network accepted them.

Optional remote alerts deduplicate outage, battery, battery-health, thermal,
power, KeepAwake, network, and Chrome Remote Desktop transitions and record
recoveries. The Cloudflare Worker checks offline state every minute under a D1
lease, retries temporary delivery failures with bounded backoff, and can fail
over to a second webhook. An optional external canary can verify that the
scheduler itself is alive. Server-side webhook destinations are never included
in heartbeat data.
Battery-health alerts have configurable absolute and rapid-drop thresholds;
non-critical thermal pressure must persist across two samples before alerting.

## Reboot and logout recovery

Before a supervised reboot:

```bash
sudo remote-mac-keepawake recovery-check --system
```

Expected result:

```text
Reboot recovery readiness: ready
Launch domain:            system
RunAtLoad / KeepAlive:    true / true
Service / assertion:      running / true
```

Recovery procedure:

1. Confirm whether FileVault is enabled.
2. Arrange physical pre-boot unlock if FileVault is on.
3. Reboot only when loss of remote access is recoverable.
4. Reconnect and rerun `recovery-check --system`.
5. Confirm the system domain, `running` state, numeric PID, and
   `idle_sleep_prevented: true`.

For a logout-only test, log out of the GUI account, reconnect over an
independent path such as SSH, and rerun the same system-mode check.

## Atomic upgrade

Upgrade directly from a verified GitHub release:

```bash
sudo remote-mac-keepawake upgrade --system --release latest
# Or pin an exact reviewed release:
sudo remote-mac-keepawake upgrade --system --release 1.4.0
```

The CLI downloads the release archive and `SHA256SUMS` over HTTPS, rejects a
missing or mismatched checksum and unsafe archive paths, verifies the candidate,
then performs the same atomic replacement and health check. Downgrades require
an explicit `--allow-downgrade`. If the optional heartbeat reporter is already
installed, the verified release upgrades and rolls back both CLIs as one
operation. There is no unattended background updater.

If the command reports a failure, it restores the prior executable(s); repair
the reported service or network problem, confirm `status --json`, and rerun the
pinned version. Use `--allow-downgrade` only for a deliberately reviewed
recovery release.

Download or clone a reviewed version, then ask the installed CLI to validate
and replace itself:

```bash
sudo remote-mac-keepawake upgrade --system \
  --from /path/to/remote-mac-keepawake/bin/remote-mac-keepawake
```

Before replacement, the candidate must pass:

- Bash syntax validation;
- semantic-version validation;
- executable-mode validation;
- declared-versus-reported version validation.

Failed replacement or post-verification restores the previous CLI.

## Uninstall

```bash
remote-mac-keepawake uninstall --user
sudo remote-mac-keepawake uninstall --system
```

Uninstall prints each project-owned plist and CLI path it removes. Diagnostic
logs are preserved and their location is reported.

## Releases and verification

Every semantic-version tag publishes:

- reviewed bilingual release notes when provided, otherwise generated notes;
- GitHub source archives;
- a mode-preserving project archive;
- an SPDX software bill of materials;
- `SHA256SUMS` and GitHub artifact provenance attestations.

Verify a downloaded v1.4.0 archive:

```bash
shasum -a 256 -c SHA256SUMS
tar -tzf remote-mac-keepawake-v1.4.0.tar.gz
gh attestation verify remote-mac-keepawake-v1.4.0.tar.gz \
  --repo xudaniel/remote-mac-keepawake
```

The archive includes both CLIs, Mac Pulse dashboard source and migrations,
this English README, the [Chinese README](README.zh-CN.md), the
[English PRD](docs/PRD.en.md), and the [Chinese PRD](docs/PRD.zh-CN.md).
It also includes both architecture documents and version-specific release notes.

## Supported systems and CI

Continuously tested on GitHub-hosted macOS 14, macOS 15, and macOS 26 runners.

CI verifies:

- ShellCheck and Bash syntax;
- user/system installation and idempotency;
- injected plist, bootstrap, kickstart, assertion, and upgrade failures;
- rollback and cleanup boundaries;
- valid JSON and plist output;
- executable modes;
- signed heartbeat installation, key rotation, replay, network diagnostics,
  speed caching, and cleanup;
- dashboard lint, build, route behavior, and additive D1 migrations;
- bilingual documentation and release metadata;
- a real LaunchAgent restart with a restored `pmset` assertion.

## Product requirements

The product scope, user journeys, requirements, architecture, success criteria,
and roadmap are maintained in:

- [Product Requirements Document — English](docs/PRD.en.md)
- [产品需求文档 — 简体中文](docs/PRD.zh-CN.md)

## Development

```bash
./tests/test.sh
./tests/docs-test.sh
./tests/heartbeat-test.sh
(cd dashboard && npm ci && npm run lint && npm test)
./.github/tests/launchd-integration.sh
```

The integration test changes only this project's user LaunchAgent and cleans it
up on exit.

## License

[MIT](LICENSE)
