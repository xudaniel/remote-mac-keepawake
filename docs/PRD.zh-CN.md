# 产品需求文档：Remote Mac KeepAwake

| 字段 | 内容 |
| --- | --- |
| 产品版本 | 1.4.0 |
| 文档状态 | Release 基线 |
| 负责人 | Daniel Xu |
| 最后更新 | 2026-08-22 |
| 支持平台 | macOS 14、15、26 |
| 许可证 | MIT |

[中文 README](../README.zh-CN.md) | [English PRD](PRD.en.md)

## 1. 执行摘要

Remote Mac KeepAwake 是一款本地优先的命令行工具。它把 macOS 自带的
`/usr/bin/caffeinate -i` 交给 launchd 管理，从而让 Mac 在远程管理期间不会
因为闲置而进入系统睡眠。

产品把“假成功”视为严重可靠性缺陷：任何会改变状态的命令，只有在服务状态、
受管 PID 和有效的闲置防睡眠 assertion 全部验证成功后，才可以显示成功。

v1.4.0 使用可轮换签名心跳、自主重试提醒、电池健康与温控历史、隐私保护网络
故障定位和 checksum 校验升级来强化 Mac Pulse。它不会扩展 Mac 的物理能力；电源、网络、合盖、
硬件、操作系统故障和 FileVault 启动前解锁均不属于产品能够控制的范围。

## 2. 问题定义

远程管理 Mac 时，如果 macOS 因闲置进入睡眠，用户可能立即失去访问能力。只在
终端里临时运行一个进程并不可靠，因为登出、重启、shell 退出或进程故障都可能
让它消失。远程用户还需要知道防睡眠是否**真正生效**，而不只是配置文件存在。

因此，产品必须提供：

1. 由 launchd 持续监督的服务；
2. 基于实际结果的验证，而不是乐观提示；
3. 安全的用户模式和系统模式；
4. 可机器读取的健康诊断；
5. 明确的隐私和运维安全边界；
6. 可审核、可通过 checksum 验证的 release。

## 3. 目标用户

### 3.1 远程 Mac 用户

通过屏幕共享、Chrome Remote Desktop、SSH 或私有网络连接一台不在身边的
Mac。

核心需求：在不削弱其他安全机制的前提下，防止闲置睡眠。

### 3.2 远程管理员

维护一台或多台专用 Mac，需要稳定的命令路径、诊断、升级行为和适合自动化的
输出。

核心需求：确认服务是否健康，并在生命周期命令失败时安全恢复。

### 3.3 重视安全的运维者

要求没有后台云依赖、没有默认遥测、权限最小化、出站网络行为明确，并且发布
文件可验证。

核心需求：清楚知道运行了什么、写入了什么、哪些数据可能离开设备。

## 4. 产品原则

1. **失败即关闭。** 必要条件失败时绝不显示成功。
2. **使用系统原生能力。** 依赖 launchd、caffeinate、pmset 和 macOS 标准工具。
3. **默认本地。** 只有用户显式启用网络检查或 webhook 时才允许出站请求。
4. **最小必要权限。** 用户模式不需要管理员权限；系统模式只为系统文件和
   launchd 使用管理员权限。
5. **先确保可恢复，再替换。** 所有变更都应先暂存、验证、备份，并能回滚。
6. **明确说明限制。** 不把“防止闲置睡眠”宣传成“保证永远在线”。
7. **双语一致。** 英文和简体中文文档必须描述相同的命令、安全边界和版本。

## 5. 目标与非目标

### 5.1 产品目标

- 服务健康时防止闲置系统睡眠；
- 通过 launchd 自动启动并重启 caffeinate；
- 验证 launchd 状态、PID 和对应 pmset assertion；
- 支持用户模式和开机启动的系统模式；
- 从用户模式原子迁移到系统模式；
- 提供稳定的文本和 JSON 诊断；
- 支持有界本地监测和显式启用的状态变化告警；
- 安装稳定 CLI，并支持原子自升级；
- 发布经过测试且带 SHA-256 校验的语义版本；
- 维护完整一致的英文和简体中文文档。

### 5.2 非目标

- 唤醒已经睡眠或关机的 Mac；
- 绕过 FileVault、登录、锁屏或其他安全机制；
- 在不受支持的 MacBook 配置上阻止合盖睡眠；
- 修复电源、电池、网络、路由器、运营商、硬件、kernel 或系统故障；
- 提供远程桌面、VPN、SSH server 或带外管理；
- 收集集中式设备遥测；
- 自动重启远程 Mac。

## 6. 核心用户流程

### 6.1 首次安装用户模式

1. 用户 clone 仓库或下载已审核的 release；
2. 在源码目录运行 `remote-mac-keepawake install --user`；
3. 产品暂存并验证 plist 与稳定 CLI；
4. 激活 LaunchAgent；
5. 验证状态、PID 和 assertion；
6. 只有全部成功后才显示稳定 CLI 路径。

失败结果：删除未完成文件或恢复旧版本，命令返回非零退出码。

### 6.2 把专用 Mac 迁移到系统模式

1. 运维者确认现场恢复能力和 FileVault 影响；
2. 运行 `sudo ... migrate --system --yes`；
3. 产品在暂存系统模式时保持用户服务运行；
4. 验证 root 属主、权限、plist、system domain、PID 和 assertion；
5. 只有系统模式健康后才删除用户模式。

失败结果：原有用户安装继续工作。

### 6.3 诊断远程可用性

1. 运维者运行 `health --json`；
2. 产品报告本地服务、assertion、电源、电池、充电和合盖状态；
3. 运维者可以显式增加 `--network` 或 `--chrome`；
4. 退出码区分 healthy、unavailable 和 degraded。

### 6.4 监测状态变化

1. 运维者运行 `health --watch --interval N`；
2. 产品写入 JSON 快照，并只保留最新 200 条；
3. 如果显式启用，本机通知或 HTTPS webhook 只在健康状态变化时触发。

### 6.5 安全升级

1. 运维者下载或 clone 已审核候选版本；
2. 已安装 CLI 检查候选文件语法和语义版本；
3. 候选文件在替换前必须输出与声明一致的版本；
4. 产品备份并原子替换 CLI；
5. 验证最终安装结果，否则恢复备份。

## 7. 功能需求

### FR-1：launchd 服务

- 受管程序必须是 `/usr/bin/caffeinate`，参数为 `-i`；
- plist 必须启用 `RunAtLoad` 和 `KeepAlive`；
- 显示器仍可正常自动熄灭。

### FR-2：经过验证的生命周期命令

- `install`、`start`、`restart` 遇到必要文件或 launchctl 操作失败时必须返回
  非零退出码；
- 成功必须同时满足：文件存在、服务 running、PID 为数字，并且 pmset 中存在
  对应 caffeinate assertion；
- 新安装失败必须清理未完成文件；
- 重新安装失败必须恢复最后已知可用版本；
- JSON 错误模式必须输出有效、可机器读取的 JSON。

### FR-3：安装模式

- 用户 plist：`$HOME/Library/LaunchAgents/com.xudaniel.remote-mac-keepawake.plist`；
- 用户 CLI：`$HOME/.local/bin/remote-mac-keepawake`；
- 系统 plist：`/Library/LaunchDaemons/com.xudaniel.remote-mac-keepawake.plist`；
- 系统 CLI：`/usr/local/bin/remote-mac-keepawake`；
- 必须拒绝意外同时安装两种模式；
- 系统文件必须属于 `root:wheel`，plist 权限为 `0644`，CLI 权限为 `0755`。

### FR-4：迁移与恢复

- `migrate --system --yes` 必须先激活并验证系统模式，再删除用户模式；
- 系统激活失败时，用户模式必须继续可用；
- `recovery-check --system` 必须检查属主、权限、plist、RunAtLoad、KeepAlive、
  launch domain、状态、PID、assertion，以及可读取时的 FileVault 状态。

### FR-5：状态与健康检查

- `status` 必须报告安装模式、状态、PID、assertion、plist 和稳定 CLI 路径；
- `status --json` 必须输出有效 JSON；
- `health --json` 必须遵守第 9 节 schema；
- 健康退出码固定为：0 healthy、1 unavailable、2 degraded；
- 格式错误的传感器输出必须规范为 `null`，不能破坏 JSON。
- 电池状况、循环次数、设计容量、满充容量、容量估算健康度和温控压力必须只读
  采集；无法读取的值必须规范为 `null`。

### FR-6：可选监测

- `--network` 和 `--chrome` 默认关闭；
- 网络检查只能联系文档中说明的 HTTPS endpoint；
- watch interval 必须为正整数；
- watch 日志最多保留 200 行；
- webhook URL 必须使用 HTTPS；
- webhook payload 不得包含主机名、用户名、PID、电量或密钥。

### FR-7：运维命令

- `self-test` 检查 CLI 语法、caffeinate 可用性、已安装 plist 和服务验证；
- `doctor` 提供本地诊断信息并重复说明产品限制；
- `logs` 显示 stdout、stderr 和 watch 日志路径；
- `uninstall` 只删除项目自己的 plist 和 CLI，逐项报告，并保留日志。

### FR-8：升级与分发

- 升级必须验证 Bash 语法和三段式语义版本；
- 候选文件在替换前必须输出其声明版本；
- 替换必须原子且可回滚；
- Git 和 release 归档必须保留可执行权限；
- release assets 必须包含 SHA-256 校验文件。
- `upgrade --release` 只能通过 HTTPS 下载；checksum 校验或归档安全路径检查失败时
  必须拒绝，默认拒绝降级，替换后必须健康检查，失败时恢复旧 CLI；不得后台自动
  更新。

### FR-9：文档与本地化

- `README.md` 是英文操作指南；
- `README.zh-CN.md` 是简体中文操作指南；
- `docs/PRD.en.md` 和 `docs/PRD.zh-CN.md` 分别定义英文和中文产品范围；
- 四份文档必须显示同一当前版本，并互相链接；
- release 归档必须包含全部四份文档。

### FR-10：可选 Mac Pulse 面板

- 生产环境查看必须使用仅限所有者的站点身份；上传授权必须保持分离并默认拒绝；
- 每个生产心跳必须使用 HMAC-SHA-256 签名，并绑定 key ID、传输时间、样本 ID、
  请求路径和正文；服务端必须强制五分钟防重放，在不保存来源 IP 的前提下限制
  失败，并支持有限的 current/next/previous 密钥轮换；
- 首屏必须同时显示连接可能性、本地准确心跳时间与年龄、预计下次心跳、电量、
  充电、电源和主要风险，不得把推测写成确定原因；
- 已接收心跳不得自动清理。历史接口必须采用有界时间范围和 cursor 分页，并提供
  仅限所有者的 CSV 导出与明确、不可撤销的删除确认；
- 上报组件必须在上传前原子保存每个样本，把失败样本留在私密本地 outbox，恢复后
  分批补传，显示待传数量和最后成功时间，并使用随机幂等 ID。补传必须保留实际
  观测时间、避免重复入库，也不得触发过期的历史提醒；
- 面板必须分别显示 KeepAwake、电源、网络和 Chrome Remote Desktop 的已检查、
  通过、失败和未知状态，提供安全恢复建议和可复制、不含密钥的摘要；
- 可选互联网测速必须在被监控的 Mac 上执行，不能在查看者浏览器中执行；必须显示
  下载、上传、空闲延迟、响应能力和准确测速时间。心跳之间复用缓存，默认间隔为
  6 小时，并拒绝低于 30 分钟的间隔；
- 可选提醒必须对持续异常去重，单独记录恢复事件，不得把通知目标写入心跳或 Git，
  并且只能发送最小化事件 payload；
- 每分钟 Worker schedule 必须在 D1 租约下检查离线状态；发送次数、有限退避、
  最终目标和最终成功时间必须持久化；备用 Webhook 与 scheduler canary 可选；
- 可选网络诊断必须区分本地路由/网关、DNS、公共 HTTPS 和 Dashboard ingest 故障，
  按可配置缓存周期记录网关延迟、抖动、丢包和准确时间，绝不保存网关、DNS、
  SSID、公网 IP 或 endpoint 标识；
- HTTPS 探测端点必须可由运维者配置，使用严格超时和较低进程优先级；
- 手机面板必须能在 320 CSS 像素下重排，提供清晰键盘焦点、可读双语标签、语义
  landmark、实时状态播报和至少 44 CSS 像素的主要控制项。
- 公开 GitHub Pages 查看器必须默认使用醒目标记的合成数据。只有当操作者在可信
  浏览器中输入独立查看凭据后，私有模式才可以只读访问状态与历史。
- 静态查看器不得使用分析或第三方运行时资源，不得把凭据放入 URL 或永久存储，
  也不得接受心跳上传或签名密钥。除非面板明确配置完全匹配的查看器来源，否则
  跨域访问必须默认拒绝；跨域写入必须始终禁止。

## 8. CLI 契约

| 命令 | 用途 | 是否修改状态 | 权限 |
| --- | --- | --- | --- |
| `install` | 暂存、安装、激活并验证 | 是 | 按模式使用用户或 root |
| `migrate` | 从用户模式原子交接到系统模式 | 是 | root |
| `recovery-check` | 验证开机恢复准备状态 | 否 | 只读；建议系统上下文 |
| `start` | 激活并验证服务 | 是 | 按模式使用用户或 root |
| `stop` | 停止服务但保留文件 | 是 | 按模式使用用户或 root |
| `restart` | 停止、重新激活并验证 | 是 | 按模式使用用户或 root |
| `status` | 报告安装和 assertion 状态 | 否 | 无 |
| `health` | 报告服务和设备风险信号 | 否，watch 日志除外 | 无 |
| `doctor` | 显示诊断信息和产品限制 | 否 | 无 |
| `logs` | 显示项目日志尾部 | 否 | 无 |
| `self-test` | 验证本地安装 | 否 | 无 |
| `upgrade` | 验证并替换稳定 CLI | 是 | 按模式使用用户或 root |
| `uninstall` | 删除项目 plist 和 CLI | 是 | 按模式使用用户或 root |

## 9. Health JSON 契约

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `timestamp` | string | UTC ISO-8601 |
| `version` | string | CLI 语义版本 |
| `health` | string | `healthy`、`unavailable` 或 `degraded` |
| `mode` | string | `user` 或 `system` |
| `installed` | boolean | 所选模式的文件是否存在 |
| `service_state` | string | 解析后的 launchd 状态 |
| `pid` | number 或 null | 受管 PID |
| `idle_sleep_prevented` | boolean | 是否存在对应 assertion |
| `power_source` | string | pmset 电源来源 |
| `battery_percent` | number 或 null | 规范化电量百分比 |
| `battery_condition` | string 或 null | 规范化 Apple 电池状况 |
| `battery_cycle_count` | number 或 null | 只读循环次数 |
| `battery_design_capacity_mah` | number 或 null | 设计容量 |
| `battery_full_charge_capacity_mah` | number 或 null | 当前满充容量 |
| `battery_health_percent` | number 或 null | 满充/设计容量估算值 |
| `thermal_state` | string 或 null | 规范化 macOS 温控压力状态 |
| `charging` | boolean 或 null | 规范化充电状态 |
| `lid_closed` | boolean 或 null | 规范化合盖状态 |
| `network_checked` | number | 只有显式请求时为 1 |
| `network_available` | boolean 或 null | 未检查或未知时为 null |
| `chrome_checked` | number | 只有显式请求时为 1 |
| `chrome_running` | boolean 或 null | 未检查或未知时为 null |

Schema 不得包含主机名、用户名、设备序列号、IP 地址、webhook URL 或密钥。

可选 Mac Pulse reporter 会追加以下向后兼容字段。旧 reporter 可以不提供；启用
测速后，在第一次成功测速之前，测量值可以为 null。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `internet_speed_enabled` | boolean | reporter 是否显式启用测速 |
| `internet_download_mbps` | number 或 null | 下载 Mbps |
| `internet_upload_mbps` | number 或 null | 上传 Mbps |
| `internet_latency_ms` | number 或 null | 空闲往返延迟 |
| `internet_responsiveness_rpm` | number 或 null | 每分钟往返次数，越高越好 |
| `internet_speed_measured_at` | string 或 null | 缓存测速结果的 UTC ISO-8601 时间 |
| `network_diagnostics_enabled` | boolean | reporter 是否显式启用诊断 |
| `network_route_available` | boolean 或 null | 默认路由结果 |
| `network_gateway_reachable` | boolean 或 null | 网关探测结果 |
| `network_dns_available` | boolean 或 null | DNS 解析结果 |
| `network_https_available` | boolean 或 null | 公共 HTTPS 结果 |
| `network_ingest_reachable` | boolean 或 null | Dashboard ingest 可达性 |
| `network_gateway_latency_ms` | number 或 null | 网关平均延迟 |
| `network_gateway_jitter_ms` | number 或 null | 网关抖动 |
| `network_gateway_packet_loss_percent` | number 或 null | 网关丢包率 |
| `network_fault` | string | 规范化故障类别 |
| `network_diagnostics_measured_at` | string 或 null | 准确 UTC 测量时间 |

## 10. 架构

```text
运维 CLI
    |
    +-- 生成并验证 plist
    +-- 安装稳定 CLI
    +-- 在 gui/<uid> 或 system domain 调用 launchctl
    +-- 读取 launchctl 状态和受管 PID
    +-- 读取 pmset assertion、电源和电池状态
    +-- 按需读取合盖、路由、网络和 CRD 进程状态
    |
launchd
    |
    +-- 监督 /usr/bin/caffeinate -i

可选 Mac Pulse reporter
    |
    +-- 按受限间隔调用 /usr/bin/networkQuality
    +-- 把最后一次有效结果保存在权限为 0600 的缓存文件中
    +-- 在每次已授权心跳中上传缓存结果
```

核心 CLI 没有自有 daemon 二进制、网络服务器、数据库、特权 helper、浏览器扩展
或必需的云控制平面。Mac Pulse 是独立、可选、仅限所有者授权的面板，使用外部
D1 保存心跳；即使不启用 Mac Pulse，CLI 仍可完整使用。

## 11. 隐私与安全需求

- 默认操作不得发送出站网络请求；
- 网络连通性、本机通知和 webhook 都必须显式启用；
- 互联网测速必须显式启用，只能使用文档指定的 macOS 工具；临时失败时保留最后
  一次有效缓存，且测速间隔不得短于 30 分钟；
- 用户模式不得要求 root；
- 系统模式必须验证准确属主和权限；
- 卸载只能删除固定的项目专属路径；
- 健康日志不得输出 webhook URL；
- 文档必须提醒用户把 webhook URL 当作密钥；
- CI action 必须固定到已审核的 commit SHA；
- 必须向 release 用户提供 checksum 校验方法。
- Mac Pulse 心跳不得存储或传输电脑名称、用户名、IP 地址、序列号、位置、webhook
  目标或凭据；
- Mac Pulse webhook payload 只能包含产品名、提醒类型、状态、级别和发生时间。

## 12. 可靠性与故障处理

| 故障 | 必须采取的行为 |
| --- | --- |
| 创建临时文件失败 | 返回非零；旧服务不变 |
| plist lint 失败 | 返回非零；删除暂存文件 |
| CLI 复制或语法检查失败 | 返回非零；旧服务不变 |
| launchctl bootstrap 失败 | 恢复旧文件和旧服务 |
| launchctl kickstart 失败 | 恢复旧文件和旧服务 |
| 无法验证 assertion | 报告失败并回滚安装 |
| 升级候选文件无效 | 替换前拒绝 |
| 升级后验证失败 | 恢复旧 CLI |
| 传感器输出格式错误 | 输出 JSON `null`，不破坏 schema |
| webhook 发送失败 | 本地警告，继续监测 |

## 13. 成功衡量

项目不收集分析数据，成功通过本地和 CI 证据衡量：

- 注入的生命周期故障中不存在假成功路径；
- 所有支持的 macOS matrix job 通过；
- 真实 LaunchAgent 集成测试可恢复被终止的 caffeinate 及其 assertion；
- healthy、degraded、unavailable 和格式错误场景的 JSON 都可解析；
- Git 和 release 中可执行权限保持 `100755`；
- 英文和中文文档版本保持一致；
- 下载归档的 checksum 验证成功。

## 14. v1.4.0 验收标准

- [ ] KeepAwake 与 heartbeat CLI 均输出版本 `1.4.0`；
- [ ] Dashboard package 输出版本 `1.4.0`；
- [ ] 可靠性测试在所有支持的 macOS runner 上通过；
- [ ] ShellCheck 零问题；
- [ ] 真实 launchd 重启集成测试通过；
- [ ] Heartbeat 安装、上报、测速缓存、状态和卸载测试通过；
- [ ] Heartbeat 签名、防重放、轮换、网络诊断和凭据权限测试通过；
- [ ] 自主 scheduler 租约、持久重试、fallback 和 canary 测试通过；
- [ ] 电池健康与温控解析保持只读，并能安全处理错误输入；
- [ ] Release 升级能拒绝 checksum 篡改和未明确允许的降级；
- [ ] Dashboard lint、构建、路由测试和增量 migration 测试通过；
- [ ] 英文和中文 README 完整且互相链接；
- [ ] 英文和中文 PRD 完整且互相链接；
- [ ] 文档测试确认版本与归档内容一致；
- [ ] 合并后 main CI 通过；
- [ ] tag `v1.4.0` 指向已审核的 main commit；
- [ ] GitHub release 包含源码包、项目归档和 `SHA256SUMS`；
- [ ] 下载后的项目归档通过 SHA-256 校验，并包含两个 CLI、Dashboard 源码与
  migrations、两份 README 和两份 PRD。

## 15. 发布流程

1. 对齐 CLI、heartbeat、dashboard、changelog、中英文 README 和 PRD 版本；
2. 本地运行 Bash、ShellCheck、可靠性、heartbeat、dashboard、migration、文档、
   YAML 和文件权限检查；
3. 发布 feature branch 和 pull request；
4. 要求托管 CI 全绿且没有未解决 review thread；
5. 把准确的已审核 head 合并到 main；
6. 要求合并后的 main CI 全绿；
7. 在准确 main commit 上创建 tag `v1.4.0`；
8. 验证 release workflow、asset 名称、归档内容和 checksum。

## 16. 风险与缓解措施

| 风险 | 缓解措施 |
| --- | --- |
| 用户把“保持唤醒”理解为保证在线 | 在安装说明之前明确物理和安全限制 |
| 远程重启导致 FileVault Mac 无法连接 | 要求现场恢复安排和系统恢复检查 |
| 不同 launchd domain 行为不同 | 使用明确 gui UID 或 system target，并验证状态 |
| pipefail 导致 assertion 误判 | 完整消费 pmset 输出，并在真实 Mac 上测试 |
| 两种安装模式冲突 | 检测并拒绝重复，提供原子迁移 |
| webhook 泄露设备信息 | 只发送固定、最小的状态 payload |
| 双语文档发生漂移 | CI 执行版本、链接和归档文档测试 |
| release 丢失可执行位 | 用 `install -m 0755` 明确构建归档 |

## 17. v1.4.0 之后的路线图

以下方向需要另行评审，不代表承诺：

- 在不增加特权 helper 的前提下提供签名或 notarized 分发；
- 为每种告警提供商进行外部验证的可控离线演练；
- 提供机器可读的命令 schema；
- 自动检查中英文术语一致性；
- 为多台远程 Mac 提供不依赖集中遥测的运维手册；
- 为 release 提供签名 provenance 和软件物料清单。

任何后续功能都不能削弱本地优先、失败即关闭的安全模型。
