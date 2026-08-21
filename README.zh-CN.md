# Remote Mac KeepAwake

[![CI](https://github.com/xudaniel/remote-mac-keepawake/actions/workflows/ci.yml/badge.svg)](https://github.com/xudaniel/remote-mac-keepawake/actions/workflows/ci.yml)

[English](README.md) | [简体中文](README.zh-CN.md)  
[英文 PRD](docs/PRD.en.md) | [中文 PRD](docs/PRD.zh-CN.md)

当前版本：v1.2.0

Remote Mac KeepAwake 使用 macOS 自带的 `caffeinate -i`，并交给
`launchd` 持续管理。它可以防止电脑因为闲置而进入系统睡眠，在进程退出后
自动重启，并为远程管理提供明确、可机器读取的健康检查。

本项目坚持本地优先：

- 不需要第三方运行环境或后台服务器；
- 不需要注册账号或使用云服务；
- 默认不发送任何遥测数据；
- 只有在 launchd 状态、PID 和防睡眠 assertion 全部验证成功后才显示成功。

## 能力边界

本工具只能在 `caffeinate` 服务健康运行时防止**闲置系统睡眠**，显示器仍然
可以正常自动熄灭。

没有任何软件能够保证远程 Mac 永远在线。本项目无法解决：

- MacBook 合盖或电池耗尽；
- 充电器、插座、路由器、Wi-Fi、运营商或硬件故障；
- 强制关机、kernel panic 或操作系统故障；
- 完整重启后的 FileVault 启动前解锁界面。

如果 Mac 已经睡眠或关机，GitHub 仓库本身无法唤醒它。远程使用的 MacBook 应
保持开盖、连接稳定电源和网络，按需要启用“通过网络唤醒”，并保留第二条远程
访问路径。

## 快速安装

普通用户模式不需要 `sudo`：

```bash
git clone https://github.com/xudaniel/remote-mac-keepawake.git
cd remote-mac-keepawake
./bin/remote-mac-keepawake install --user
```

安装后的稳定命令路径：

```text
$HOME/.local/bin/remote-mac-keepawake
```

如果 shell 找不到命令，可加入 PATH：

```bash
export PATH="$HOME/.local/bin:$PATH"
remote-mac-keepawake status --user
```

显示安装成功代表以下三项都已通过：

1. plist 已安装且语法有效；
2. launchd 报告服务正在运行并有受管 PID；
3. `pmset -g assertions` 确认该 PID 正在阻止闲置系统睡眠。

## 专用远程 Mac：系统模式

用户模式需要该用户登录后才启动。系统模式在开机过程中启动，不依赖图形界面
登录，并把 CLI 安装到：

```text
/usr/local/bin/remote-mac-keepawake
```

把现有用户模式安全迁移到系统模式：

```bash
sudo "$HOME/.local/bin/remote-mac-keepawake" migrate --system --yes
sudo /usr/local/bin/remote-mac-keepawake recovery-check --system
```

迁移过程中，原用户服务会一直保留，直到系统 LaunchDaemon 的属主、文件权限、
plist、launchd domain、PID 和 assertion 全部验证成功。如果系统服务激活失败，
用户模式仍然可用。

只有在能够现场恢复电脑时才执行迁移或重启。如果 FileVault 已开启，远程软件
无法通过重启后的启动前解锁界面。

## 常用命令

安装后可以在任何目录运行：

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

暂时允许正常闲置睡眠：

```bash
remote-mac-keepawake stop
```

重新启用并验证：

```bash
remote-mac-keepawake start
```

## 健康检查

`health` 提供稳定的 JSON 字段和适合脚本使用的退出码：

| 退出码 | 状态 | 含义 |
| --- | --- | --- |
| `0` | healthy | 服务、PID 和 assertion 均正常。 |
| `1` | unavailable | 服务、PID 或 assertion 缺失。 |
| `2` | degraded | 显式检查的依赖存在风险。 |

```bash
remote-mac-keepawake health --json
remote-mac-keepawake health --json --network --chrome
```

默认检查完全在本机完成，包括：

- launchd 模式和服务状态；
- 受管 PID 和防睡眠 assertion；
- 电源来源、电量和充电状态；
- MacBook 合盖状态。

可选检查：

- `--network`：确认默认路由，并向 Apple 网络连通性页面发送 HTTPS HEAD
  请求；
- `--chrome`：在本机检查 Chrome Remote Desktop Host 进程。

默认情况下这两项都不会运行。

## 持续监测和告警

Watch 模式只保留最新 200 条 JSON 记录：

```bash
remote-mac-keepawake health --watch --interval 60
```

可选的状态变化告警：

```bash
remote-mac-keepawake health --watch --notify --interval 60
remote-mac-keepawake health --watch \
  --webhook https://example.com/remote-mac-health
```

通知和 webhook 都必须显式启用。Webhook 只接受 HTTPS，发送内容仅包括服务名、
健康状态和安装模式，不包含主机名、用户名、PID、电量或任何密钥。

## 重启和登出恢复检查

在有人能够恢复电脑的前提下，重启前运行：

```bash
sudo remote-mac-keepawake recovery-check --system
```

预期结果：

```text
Reboot recovery readiness: ready
Launch domain:            system
RunAtLoad / KeepAlive:    true / true
Service / assertion:      running / true
```

恢复流程：

1. 确认 FileVault 是否开启；
2. 如果已开启，安排现场完成启动前解锁；
3. 只有在远程失联后仍可恢复时才重启；
4. 重新连接后再次运行 `recovery-check --system`；
5. 确认 system domain、`running` 状态、数字 PID，以及
   `idle_sleep_prevented: true`。

只测试登出时，可以退出图形界面账号，通过 SSH 等独立路径重新连接，再运行同一
条系统模式检查命令。

## 原子升级

下载或 clone 已审核的新版本，然后让已安装的 CLI 自行验证并替换：

```bash
sudo remote-mac-keepawake upgrade --system \
  --from /path/to/remote-mac-keepawake/bin/remote-mac-keepawake
```

替换之前，新文件必须通过：

- Bash 语法检查；
- 语义版本检查；
- 可执行权限检查；
- 声明版本与实际输出版本一致性检查。

替换或验证失败时会恢复旧 CLI。

## 卸载

```bash
remote-mac-keepawake uninstall --user
sudo remote-mac-keepawake uninstall --system
```

卸载会逐项打印被删除的项目专属 plist 和 CLI 路径。诊断日志会被保留，并显示其
所在目录。

## Release 与校验

每个语义版本 tag 都会发布：

- 自动生成的 GitHub release notes；
- GitHub 源码压缩包；
- 保留可执行权限的项目归档；
- `SHA256SUMS`。

校验 v1.2.0 下载文件：

```bash
shasum -a 256 -c SHA256SUMS
tar -tzf remote-mac-keepawake-v1.2.0.tar.gz
```

项目归档包括本中文 README、[英文 README](README.md)、
[英文 PRD](docs/PRD.en.md) 和 [中文 PRD](docs/PRD.zh-CN.md)。

## 支持系统与 CI

持续测试 GitHub 托管的 macOS 14、macOS 15 和 macOS 26 runner。

CI 检查：

- ShellCheck 与 Bash 语法；
- 用户/系统安装和幂等性；
- plist、bootstrap、kickstart、assertion 和升级故障注入；
- 回滚和清理边界；
- JSON 与 plist 有效性；
- 可执行权限；
- 中英文文档与 release 元数据一致性；
- 真实 LaunchAgent 重启以及恢复后的 `pmset` assertion。

## 产品需求文档

产品范围、用户流程、需求、架构、成功标准和路线图分别记录在：

- [产品需求文档 — 简体中文](docs/PRD.zh-CN.md)
- [Product Requirements Document — English](docs/PRD.en.md)

## 开发与测试

```bash
./tests/test.sh
./tests/docs-test.sh
./.github/tests/launchd-integration.sh
```

集成测试只会操作本项目自己的用户 LaunchAgent，并在退出时清理。

## 许可证

[MIT](LICENSE)
