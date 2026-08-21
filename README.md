# Remote Mac KeepAwake

[![CI](https://github.com/xudaniel/remote-mac-keepawake/actions/workflows/ci.yml/badge.svg)](https://github.com/xudaniel/remote-mac-keepawake/actions/workflows/ci.yml)

Keep a remote Mac available by running macOS's built-in `caffeinate -i` as a
verified, launchd-managed service. Version 1.1 fails closed, confirms the active
sleep assertion, installs a stable command, supports safe user-to-system
migration, and provides privacy-preserving health diagnostics.

No third-party runtime, account, server, or default telemetry is required.

## What this can and cannot do

The service prevents **idle system sleep** while its verified `caffeinate`
process is running. The display can still turn off normally.

No repository or software can guarantee that a Mac is always reachable. This
tool cannot overcome:

- a closed MacBook lid or depleted battery;
- charger, outlet, router, Wi-Fi, ISP, or hardware failure;
- a forced shutdown, kernel panic, or operating-system failure;
- the FileVault pre-boot unlock screen after a full restart.

If the Mac is already asleep, installing code from GitHub cannot wake it by
itself. Keep the lid open, use reliable power and networking, enable Apple's
Wake for Network Access where appropriate, and maintain a second access path.

## Install

Clone the repository once, then install in user mode without `sudo`:

```bash
git clone https://github.com/xudaniel/remote-mac-keepawake.git
cd remote-mac-keepawake
./bin/remote-mac-keepawake install --user
```

The installed command is `$HOME/.local/bin/remote-mac-keepawake`. Add it to
your shell path if needed:

```bash
export PATH="$HOME/.local/bin:$PATH"
remote-mac-keepawake status --user
```

User mode starts after that user signs in. A successful installation is printed
only after launchd reports the service as running and `pmset` confirms the
managed PID holds the idle-sleep assertion.

## Dedicated remote Mac: migrate to system mode

System mode starts during boot without waiting for an interactive login. It
installs the stable CLI at `/usr/local/bin/remote-mac-keepawake`.

Migrate an existing user installation:

```bash
sudo "$HOME/.local/bin/remote-mac-keepawake" migrate --system --yes
sudo /usr/local/bin/remote-mac-keepawake recovery-check --system
```

Migration keeps the working user service active until the system LaunchDaemon
passes plist, mode, ownership, launch-domain, PID, and sleep-assertion checks.
If system activation fails, the user installation remains available. The tool
never intentionally leaves both services installed.

Do this while someone can physically unlock the Mac if FileVault is enabled.

## Remote administration

After installation, these commands work from any directory:

```bash
remote-mac-keepawake status
remote-mac-keepawake status --json
remote-mac-keepawake status --watch --interval 30
remote-mac-keepawake restart
remote-mac-keepawake self-test
remote-mac-keepawake doctor
remote-mac-keepawake logs
```

To temporarily allow normal idle sleep:

```bash
remote-mac-keepawake stop
```

Turn protection back on and verify it:

```bash
remote-mac-keepawake start
```

## Health diagnostics

`health` uses stable JSON fields and exit codes suitable for remote scripts:

- `0`: healthy
- `1`: unavailable — service, PID, or assertion is missing
- `2`: degraded — an explicitly checked dependency is at risk

```bash
remote-mac-keepawake health --json
remote-mac-keepawake health --json --network --chrome
```

The default check is local. It reports service state, PID, assertion, power
source, battery, charging state, and lid state. It does not check the internet,
inspect Chrome Remote Desktop, contact a webhook, or transmit device data.

Optional checks:

- `--network` makes an HTTPS HEAD request to Apple's captive-network success
  page after confirming a default route.
- `--chrome` checks locally for the Chrome Remote Desktop host process.

Continuous monitoring keeps only the latest 200 JSON records:

```bash
remote-mac-keepawake health --watch --interval 60
remote-mac-keepawake health --watch --notify --interval 60
remote-mac-keepawake health --watch --webhook https://example.com/hook
```

Notifications and webhooks are opt-in and fire only when the health state
changes. The webhook payload contains only service name, health state, and
install mode. It does not contain the hostname, username, PID, battery level,
or secrets.

## Reboot and logout recovery check

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

Then:

1. Confirm whether FileVault is on. If it is, arrange physical pre-boot unlock.
2. Reboot only when loss of remote access is recoverable.
3. Reconnect and rerun `recovery-check --system`.
4. Expect the system domain, `running` state, a numeric PID, and
   `idle_sleep_prevented: true` in JSON output.

A logout test does not require a reboot: log out of the GUI account, reconnect
over an independent path such as SSH, and run the same system-mode check.

## Atomic upgrade

Download or clone a reviewed version, then ask the installed CLI to validate and
replace itself:

```bash
sudo remote-mac-keepawake upgrade --system \
  --from /path/to/remote-mac-keepawake/bin/remote-mac-keepawake
```

The candidate must pass Bash syntax, semantic-version, executable, and version
checks before replacement. A failed replacement restores the previous CLI.

## Uninstall

```bash
remote-mac-keepawake uninstall --user
sudo remote-mac-keepawake uninstall --system
```

Uninstall reports each owned plist and CLI path removed. Diagnostic logs are
preserved and their location is printed.

## Releases and verification

Semantic-version tags create a mode-preserving archive, generated release
notes, GitHub source archives, and `SHA256SUMS`. Verify before installing:

```bash
shasum -a 256 -c SHA256SUMS
tar -tzf remote-mac-keepawake-v1.1.0.tar.gz
```

CI pins the reviewed checkout action commit, runs ShellCheck and Bash syntax
checks, exercises injected failure/rollback paths on macOS 14, 15, and 26, and
runs a real LaunchAgent integration test that kills `caffeinate` and verifies
launchd restores it with an active `pmset` assertion.

Supported and continuously tested: macOS 14, macOS 15, and macOS 26 on
GitHub-hosted Apple-silicon runners.

## 中文说明

这个工具用 macOS 自带的 `launchd` 管理 `caffeinate -i`，防止电脑因闲置
而睡眠。v1.1 只有在服务确实运行、并且 `pmset` 验证到防睡眠 assertion 后才会
显示成功；失败时会回滚，不会给你“假成功”。

普通用户安装：

```bash
./bin/remote-mac-keepawake install --user
```

专门放在远处使用的 Mac，建议在有人能够现场解锁时迁移到系统模式：

```bash
sudo "$HOME/.local/bin/remote-mac-keepawake" migrate --system --yes
sudo remote-mac-keepawake recovery-check --system
```

请注意：它不能解决合盖睡眠、断电、断网、硬件故障或 FileVault 重启前解锁。
GitHub 仓库也不能唤醒一台已经睡着或关机的电脑。

## Development

```bash
./tests/test.sh
./.github/tests/launchd-integration.sh
```

The integration test changes only this project's user LaunchAgent and cleans it
up on exit.

## License

[MIT](LICENSE)
