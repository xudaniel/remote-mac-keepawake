# Remote Mac KeepAwake

Keep a remote Mac available by running macOS's built-in `caffeinate -i` as a
launchd-managed service. It starts automatically, restarts if the process
exits, and can be managed from any remote Terminal session.

No third-party runtime or background server is required.

## What it does

- Prevents idle system sleep while the service is running.
- Starts automatically through `launchd`.
- Restarts `caffeinate` if it exits unexpectedly.
- Supports user mode without `sudo` and system mode for stronger persistence.
- Provides `start`, `stop`, `restart`, `status`, `doctor`, and `logs` commands.
- Keeps the display free to turn off normally, reducing power use.

## Quick start

```bash
git clone https://github.com/xudaniel/remote-mac-keepawake.git
cd remote-mac-keepawake
chmod +x bin/remote-mac-keepawake tests/test.sh
./bin/remote-mac-keepawake install --user
./bin/remote-mac-keepawake status --user
```

User mode starts after that user signs in. For a dedicated remote Mac, system
mode starts earlier in the boot process and is recommended:

```bash
sudo ./bin/remote-mac-keepawake install --system
./bin/remote-mac-keepawake status --system
```

Do not install both modes at once. The CLI rejects duplicate installations.

## Remote management

After installation, connect with Chrome Remote Desktop, Screen Sharing, SSH,
or a private network such as Tailscale and run:

```bash
./bin/remote-mac-keepawake status
./bin/remote-mac-keepawake restart
./bin/remote-mac-keepawake doctor
./bin/remote-mac-keepawake logs
```

To temporarily allow normal sleep:

```bash
./bin/remote-mac-keepawake stop
```

To turn keep-awake back on:

```bash
./bin/remote-mac-keepawake start
```

If the Mac is already asleep, a GitHub repository cannot wake it by itself.
Use Wake for Network Access, Wake-on-LAN where supported, or an out-of-band
device. Keep the service running when reliable remote access is the priority.

## 中文说明

这个工具会让 macOS 的 `launchd` 持续管理系统自带的 `caffeinate -i`，防止
Mac 因闲置而进入睡眠。显示器仍可自动熄灭，不影响 Chrome Remote Desktop、
屏幕共享或 SSH。

普通安装不需要管理员密码：

```bash
./bin/remote-mac-keepawake install --user
```

如果这是专门放在远处使用的 Mac，建议人在机器旁边时安装系统模式：

```bash
sudo ./bin/remote-mac-keepawake install --system
```

远程检查：

```bash
./bin/remote-mac-keepawake status
./bin/remote-mac-keepawake doctor
```

## Important limitations

This tool prevents **idle sleep**. No software can guarantee that a remote Mac
is always reachable. It cannot prevent or repair:

- a loose or underpowered charger;
- battery depletion or a power outage;
- router, ISP, or Wi-Fi failure;
- forced shutdown, kernel panic, or hardware failure;
- normal MacBook lid sleep;
- the FileVault pre-boot unlock screen after a restart.

For dependable remote access, keep a MacBook open and connected to a stable
power adapter, prefer Ethernet, protect the router with a UPS, and maintain a
second remote-access path.

## Uninstall

```bash
./bin/remote-mac-keepawake uninstall --user
```

Or, for a system installation:

```bash
sudo ./bin/remote-mac-keepawake uninstall --system
```

## Development

Run the local checks:

```bash
./tests/test.sh
```

CI runs the same test suite on GitHub's macOS runner.

## License

[MIT](LICENSE)
