# Product Requirements Document: Remote Mac KeepAwake

| Field | Value |
| --- | --- |
| Product version | 1.2.0 |
| Document status | Release baseline |
| Owner | Daniel Xu |
| Last updated | 2026-08-20 |
| Platforms | macOS 14, 15, and 26 |
| License | MIT |

[README](../README.md) | [中文 PRD](PRD.zh-CN.md)

## 1. Executive summary

Remote Mac KeepAwake is a local-first command-line utility that keeps a Mac
available for remote administration by running macOS's built-in
`/usr/bin/caffeinate -i` under launchd. The product treats false success as a
critical reliability defect: mutating commands report success only after the
service state, managed PID, and active idle-sleep assertion are verified.

Version 1.2.0 establishes the product and documentation baseline in English
and Simplified Chinese. It does not expand the physical capabilities of the
Mac. Power, networking, lid behavior, hardware, operating-system failures, and
FileVault pre-boot unlock remain outside the product boundary.

## 2. Problem statement

People who administer a Mac remotely can lose access when macOS enters idle
sleep. A one-off terminal process is fragile because it can disappear after a
logout, restart, shell termination, or process failure. A remote owner also
needs to know whether protection is actually active, not merely configured.

The product must therefore provide:

1. persistent launchd supervision;
2. verified postconditions rather than optimistic messages;
3. safe user and system installation modes;
4. machine-readable health diagnostics;
5. explicit privacy and operational safety boundaries;
6. reviewable, checksum-verifiable releases.

## 3. Target users

### 3.1 Remote Mac owner

Uses Screen Sharing, Chrome Remote Desktop, SSH, or a private network to reach
a Mac that may be physically distant.

Primary need: prevent idle sleep without weakening unrelated security
controls.

### 3.2 Remote administrator

Maintains one or more dedicated Macs and needs predictable commands, stable
paths, diagnostics, upgrade behavior, and automation-friendly output.

Primary need: know whether the service is healthy and recover safely from a
failed lifecycle operation.

### 3.3 Security-conscious operator

Wants no background cloud dependency, no default telemetry, minimal
privileges, explicit outbound-network behavior, and verifiable artifacts.

Primary need: understand exactly what runs, what is written, and what may
leave the device.

## 4. Product principles

1. **Fail closed.** Never print success when a required postcondition failed.
2. **Use platform primitives.** Depend on launchd, caffeinate, pmset, and
   standard macOS utilities.
3. **Local by default.** Do not transmit data unless the operator explicitly
   enables an outbound check or webhook.
4. **Minimum necessary privilege.** User mode requires no administrator
   access; system mode requires it only for system-owned files and launchd.
5. **Recover before replacing.** Stage, validate, back up, and roll back
   lifecycle changes.
6. **State limitations plainly.** Do not market idle-sleep prevention as a
   guarantee of permanent reachability.
7. **Bilingual parity.** English and Simplified Chinese documentation must
   describe the same commands, safety boundaries, and release version.

## 5. Goals and non-goals

### 5.1 Goals

- Prevent idle system sleep while the managed service is healthy.
- Automatically start and restart caffeinate through launchd.
- Verify launchd state, PID, and the matching pmset assertion.
- Support user mode and boot-time system mode.
- Migrate atomically from user mode to system mode.
- Provide stable text and JSON diagnostics.
- Support bounded local monitoring and opt-in state-change alerts.
- Install a stable CLI with atomic self-upgrade.
- Publish tested, checksum-verifiable semantic releases.
- Maintain complete English and Simplified Chinese operator documentation.

### 5.2 Non-goals

- Waking a Mac that is already asleep or powered off.
- Bypassing FileVault, login, screen-lock, or other security controls.
- Preventing closed-lid sleep on unsupported MacBook configurations.
- Repairing power, battery, network, router, ISP, hardware, kernel, or OS
  failures.
- Providing a remote desktop, VPN, SSH server, or out-of-band management
  channel.
- Collecting centralized fleet telemetry.
- Automatically rebooting a remote Mac.

## 6. Primary user journeys

### 6.1 First user-mode installation

1. User clones or downloads a reviewed release.
2. User runs `remote-mac-keepawake install --user` from the source tree.
3. Product stages and validates the plist and stable CLI.
4. Product activates the LaunchAgent.
5. Product verifies state, PID, and assertion.
6. Product prints the stable CLI path only after verification succeeds.

Failure outcome: incomplete files are removed or the previous installation is
restored; the command exits non-zero.

### 6.2 Migrate a dedicated Mac to system mode

1. Operator confirms physical recovery and FileVault implications.
2. Operator runs `sudo ... migrate --system --yes`.
3. Product leaves the user service running while staging system mode.
4. Product validates root ownership, modes, plist, system launch domain, PID,
   and assertion.
5. Only after system mode is healthy does the product remove user mode.

Failure outcome: the working user installation remains active.

### 6.3 Diagnose remote availability

1. Operator runs `health --json`.
2. Product reports local service, assertion, power, battery, charging, and lid
   state.
3. Operator optionally adds `--network` or `--chrome`.
4. Exit status distinguishes healthy, unavailable, and degraded states.

### 6.4 Monitor state changes

1. Operator starts `health --watch --interval N`.
2. Product appends JSON snapshots and retains only the latest 200 records.
3. If explicitly enabled, a local notification or HTTPS webhook fires only
   when the health state changes.

### 6.5 Upgrade safely

1. Operator downloads or clones a reviewed candidate.
2. Installed CLI validates candidate syntax and semantic version.
3. Candidate must report its declared version before replacement.
4. Product backs up and atomically replaces the CLI.
5. Product verifies the installed result or restores the backup.

## 7. Functional requirements

### FR-1: launchd service

- The managed program must be `/usr/bin/caffeinate` with argument `-i`.
- The plist must enable `RunAtLoad` and `KeepAlive`.
- The display must remain free to sleep normally.

### FR-2: verified lifecycle commands

- `install`, `start`, and `restart` must exit non-zero after any required
  filesystem or launchctl failure.
- Success requires installed files, running state, numeric PID, and a matching
  caffeinate assertion in `pmset -g assertions`.
- New-install failure must remove incomplete files.
- Reinstall failure must restore the last known-good files.
- JSON error mode must produce valid machine-readable output.

### FR-3: installation modes

- User plist: `$HOME/Library/LaunchAgents/com.xudaniel.remote-mac-keepawake.plist`.
- User CLI: `$HOME/.local/bin/remote-mac-keepawake`.
- System plist: `/Library/LaunchDaemons/com.xudaniel.remote-mac-keepawake.plist`.
- System CLI: `/usr/local/bin/remote-mac-keepawake`.
- The product must reject accidental simultaneous installations.
- System files must be owned by `root:wheel`, with plist mode `0644` and CLI
  mode `0755`.

### FR-4: migration and recovery

- `migrate --system --yes` must activate and verify system mode before
  removing user mode.
- Failed system activation must leave user mode available.
- `recovery-check --system` must validate ownership, modes, plist syntax,
  RunAtLoad, KeepAlive, launch domain, state, PID, assertion, and FileVault
  status when readable.

### FR-5: status and health

- `status` must report installation mode, state, PID, assertion, plist, and
  stable CLI path.
- `status --json` must use valid JSON.
- `health --json` must use the schema in section 9.
- Health exit codes must be 0 healthy, 1 unavailable, and 2 degraded.
- Malformed sensor output must normalize to `null`, not malformed JSON.

### FR-6: optional monitoring

- `--network` and `--chrome` must be disabled by default.
- Network checking may contact only the documented HTTPS endpoint.
- Watch interval must be a positive integer.
- Watch logs must retain at most 200 lines.
- Webhook URLs must use HTTPS.
- Webhook payload must exclude hostname, username, PID, battery level, and
  secrets.

### FR-7: operational commands

- `self-test` must check CLI syntax, caffeinate availability, installed plist,
  and service verification.
- `doctor` must provide local diagnostic context and repeat product limits.
- `logs` must identify stdout, stderr, and watch-log paths.
- `uninstall` must remove only project-owned plist and CLI files, report each
  removed path, and preserve logs.

### FR-8: upgrade and distribution

- Upgrade must validate Bash syntax and a three-component semantic version.
- Candidate output must match its declared version before replacement.
- Replacement must be atomic and reversible.
- Git and release archives must preserve executable modes.
- Release assets must include SHA-256 checksums.

### FR-9: documentation and localization

- `README.md` is the canonical English operator guide.
- `README.zh-CN.md` is the Simplified Chinese operator guide.
- `docs/PRD.en.md` and `docs/PRD.zh-CN.md` define product scope in both
  languages.
- All four documents must identify the same current release and link to their
  language counterpart.
- Release archives must contain all four documents.

### FR-10: optional Mac Pulse dashboard

- Production viewing must use the owner-only site identity; ingest authorization
  must remain separate and fail closed.
- The first viewport must combine connection likelihood, exact local heartbeat
  time and age, next expected check-in, battery, charging, power, and primary
  risk without claiming a guaranteed root cause.
- Accepted heartbeat samples must not be automatically pruned. History APIs
  must use bounded time ranges and cursor pagination, with owner-only CSV export
  and an explicit irreversible deletion confirmation.
- The dashboard must expose checked, passed, failed, and unknown states for
  KeepAwake, power, network, and Chrome Remote Desktop, plus safe recovery
  guidance and a copyable secret-free summary.
- Opt-in internet speed sampling must run on the monitored Mac, not in the
  viewer's browser; expose download, upload, idle latency, responsiveness, and
  an exact measurement timestamp. Cache the result between heartbeats, default
  to a six-hour interval, and reject intervals below 30 minutes.
- Optional alerts must deduplicate active states, record distinct recoveries,
  keep destinations out of heartbeat data and Git, and send only a minimal
  event payload.
- The mobile dashboard must reflow at 320 CSS pixels, use visible keyboard
  focus, readable bilingual labels, semantic landmarks, live status
  announcements, and 44 CSS pixel primary controls.

## 8. CLI contract

| Command | Purpose | Mutates state | Privilege |
| --- | --- | --- | --- |
| `install` | Stage, install, activate, and verify | Yes | User or root by mode |
| `migrate` | Atomically hand off user to system mode | Yes | Root |
| `recovery-check` | Validate boot-time recovery readiness | No | Read-only; system context recommended |
| `start` | Activate and verify the service | Yes | User or root by mode |
| `stop` | Stop the service without deleting files | Yes | User or root by mode |
| `restart` | Stop, reactivate, and verify | Yes | User or root by mode |
| `status` | Report installation and assertion state | No | None |
| `health` | Report service and device risk signals | No, except watch log | None |
| `doctor` | Show diagnostic context and limits | No | None |
| `logs` | Display owned log tails | No | None |
| `self-test` | Validate local installation | No | None |
| `upgrade` | Validate and replace stable CLI | Yes | User or root by mode |
| `uninstall` | Remove owned plist and CLI | Yes | User or root by mode |

## 9. Health JSON contract

Required fields:

| Field | Type | Notes |
| --- | --- | --- |
| `timestamp` | string | UTC ISO-8601 |
| `version` | string | CLI semantic version |
| `health` | string | `healthy`, `unavailable`, or `degraded` |
| `mode` | string | `user` or `system` |
| `installed` | boolean | Selected-mode files exist |
| `service_state` | string | Parsed launchd state |
| `pid` | number or null | Managed PID |
| `idle_sleep_prevented` | boolean | Matching assertion exists |
| `power_source` | string | Parsed pmset power source |
| `battery_percent` | number or null | Normalized battery percentage |
| `charging` | boolean or null | Normalized charge state |
| `lid_closed` | boolean or null | Normalized clamshell state |
| `network_checked` | number | 1 only when explicitly requested |
| `network_available` | boolean or null | Null when not checked or unknown |
| `chrome_checked` | number | 1 only when explicitly requested |
| `chrome_running` | boolean or null | Null when not checked or unknown |

The schema must not include hostname, username, device serial number, IP
address, webhook URL, or secrets.

The optional Mac Pulse reporter appends these backward-compatible fields. An
older reporter may omit them; an enabled reporter may use null measurements
until the first successful test.

| Field | Type | Notes |
| --- | --- | --- |
| `internet_speed_enabled` | boolean | Explicit reporter opt-in state |
| `internet_download_mbps` | number or null | Decimal megabits per second |
| `internet_upload_mbps` | number or null | Decimal megabits per second |
| `internet_latency_ms` | number or null | Idle round-trip latency |
| `internet_responsiveness_rpm` | number or null | Round trips per minute; higher is better |
| `internet_speed_measured_at` | string or null | UTC ISO-8601 time of the cached measurement |

## 10. Architecture

```text
Operator CLI
    |
    +-- renders and validates plist
    +-- installs stable CLI
    +-- calls launchctl in gui/<uid> or system domain
    +-- reads launchctl state and managed PID
    +-- reads pmset assertion, power, and battery state
    +-- optionally reads lid, route, network, and CRD process state
    |
launchd
    |
    +-- supervises /usr/bin/caffeinate -i

Optional Mac Pulse reporter
    |
    +-- invokes /usr/bin/networkQuality at a bounded interval
    +-- caches the last valid result in a mode-0600 file
    +-- publishes the cached result with each authorized heartbeat
```

The core CLI has no project-owned daemon binary, network server, database,
privileged helper, browser extension, or required cloud control plane. Mac
Pulse is a separate, optional, owner-authorized dashboard with an external D1
heartbeat store; the CLI remains fully usable without it.

## 11. Privacy and security requirements

- Default operation must not make outbound network requests.
- Network reachability, local notifications, and webhooks require explicit
  flags.
- Internet speed testing must be opt-in, use the documented macOS tool, retain
  the last valid cache after a transient failure, and never run more frequently
  than every 30 minutes.
- User mode must not require root.
- System mode must validate exact ownership and modes.
- Paths removed during uninstall must be fixed project-owned paths.
- Webhook URLs must never be printed into health records.
- Documentation must tell users to treat webhook URLs as secrets.
- CI actions must be pinned to reviewed commit SHAs.
- Release consumers must be given checksum verification instructions.
- Mac Pulse must never store or transmit hostname, username, IP address, serial
  number, location, webhook destination, or credentials in a heartbeat.
- Mac Pulse webhook payloads must contain only product, alert kind, state,
  severity, and occurrence time.

## 12. Reliability and failure handling

| Failure | Required behavior |
| --- | --- |
| Temporary-file creation fails | Exit non-zero; existing service unchanged |
| Plist lint fails | Exit non-zero; staged files removed |
| CLI copy or syntax check fails | Exit non-zero; existing service unchanged |
| launchctl bootstrap fails | Restore previous files and service |
| launchctl kickstart fails | Restore previous files and service |
| Assertion cannot be verified | Report failure and roll back installation |
| Upgrade candidate is invalid | Reject before replacement |
| Upgrade post-check fails | Restore previous CLI |
| Sensor output is malformed | Emit JSON `null`; do not corrupt schema |
| Webhook delivery fails | Warn locally; keep monitoring |

## 13. Success measures

The project does not collect analytics. Success is measured through local and
CI evidence:

- zero false-success paths in injected lifecycle tests;
- all supported macOS matrix jobs pass;
- real LaunchAgent integration restores a killed caffeinate process and its
  assertion;
- JSON output parses in healthy, degraded, unavailable, and malformed-input
  scenarios;
- executable modes remain `100755` in Git and release archives;
- English and Chinese document versions remain aligned;
- release checksum validates the downloadable archive.

## 14. v1.2.0 acceptance criteria

- [ ] CLI reports `remote-mac-keepawake 1.2.0`.
- [ ] Reliability suite passes on supported macOS runners.
- [ ] ShellCheck reports no findings.
- [ ] Real launchd restart integration passes.
- [ ] English and Chinese README files are complete and cross-linked.
- [ ] English and Chinese PRDs are complete and cross-linked.
- [ ] Documentation test confirms version and archive alignment.
- [ ] Main branch CI passes after merge.
- [ ] Tag `v1.2.0` points to the reviewed main commit.
- [ ] GitHub release contains source archives, project archive, and
  `SHA256SUMS`.
- [ ] Downloaded project archive passes SHA-256 verification and contains both
  README files and both PRDs.

## 15. Release process

1. Update CLI version, changelog, bilingual README files, and bilingual PRDs.
2. Run Bash syntax, ShellCheck, reliability, documentation, YAML, and mode
   checks locally.
3. Publish a feature branch and pull request.
4. Require green hosted CI and no unresolved review threads.
5. Merge the exact reviewed head to main.
6. Require green post-merge main CI.
7. Create tag `v1.2.0` on the exact main commit.
8. Verify release workflow success, asset names, archive content, and checksum.

## 16. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| User interprets “keep awake” as guaranteed reachability | Put physical and security limits before installation instructions |
| Remote reboot strands a FileVault Mac | Require supervised recovery guidance and explicit system check |
| launchctl behavior differs by domain | Use explicit gui UID or system targets and verify state |
| Pipeline reports a false assertion failure | Consume full pmset output under pipefail and test on a real Mac |
| Two installation modes conflict | Detect and reject duplicates; provide atomic migration |
| Webhook leaks device information | Send a fixed minimal state-only payload |
| Documentation drifts across languages | Run a version/link/archive documentation test in CI |
| Release loses executable bit | Build archive with explicit `install -m 0755` |

## 17. Roadmap after v1.2.0

Potential future work, subject to separate review:

- signed or notarized distribution without adding a privileged helper;
- opt-in local launchd scheduling for health watch mode;
- configurable network probe endpoint with strict privacy documentation;
- machine-readable command schema documentation;
- automated bilingual terminology checks;
- an operator runbook for multiple remote Macs without centralized telemetry.

These items are not commitments and must not weaken the local-first,
fail-closed safety model.
