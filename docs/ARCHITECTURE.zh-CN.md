# 架构说明

[English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md)

Remote Mac KeepAwake 默认完全在本机运行。只有运维者显式安装 heartbeat reporter
后，才会启用可选的 Mac Pulse 路径。

```mermaid
flowchart LR
  subgraph Mac[远程 Mac]
    KA[launchd + caffeinate\n已验证防闲置睡眠 assertion]
    HB[Heartbeat reporter\n最小化且显式启用的 payload]
    OQ[私密本地 outbox\n原子写入并可补传]
    NQ[Apple networkQuality\n可选并使用缓存]
    ND[网络诊断\n可选、缓存且无标识符]
    KA --> HB
    NQ -. 运维者显式启用 .-> HB
    ND -. 运维者显式启用 .-> HB
    HB --> OQ
  end

  OQ -->|HTTPS + HMAC 签名样本| API[私有 Mac Pulse API]
  API --> DB[(完整保留的 D1 历史)]
  Owner[已认证所有者] -->|私有身份会话| UI[Mac Pulse Dashboard]
  UI --> API
  Cron[Cloudflare Cron Trigger\n每分钟] --> Worker[带租约的提醒 Worker]
  Worker --> DB
  Worker -. 最小状态事件 + 重试 .-> Webhook[主或备用 Webhook]
  Worker -. 可选存活信号 .-> Canary[外部 canary]
```

## 信任边界

- KeepAwake 在本机运行，不依赖 Mac Pulse。
- 查看者身份与 heartbeat 上传使用相互独立的授权路径。每次上传都包含
  HMAC-SHA-256 签名、key ID、五分钟防重放窗口和随机幂等 ID；轮换期间可有限接受
  current、next、previous 三个槽位，无需重启 reporter。
- Heartbeat 不包含电脑名称、用户名、IP 地址、序列号、位置、webhook 目标或密钥。
- 可选网络诊断只保存布尔结果、网关性能、规范化故障类别和时间，不保存网关、
  DNS、SSID、公网 IP 或 endpoint 标识符。
- 每个 heartbeat 都会在上传前先保存到本地；发送失败时留在受保护 outbox 中，
  恢复后使用幂等 ID 自动补传。
- Cron 在计算状态前取得 D1 租约。发送次数与有限退避重试可跨 Worker 重启保留；
  备用 Webhook 和外部 canary 均为可选，其 URL 只存在于服务端 secret。
- 没有收到 heartbeat 只能证明外部监控端没有收到近期样本，不能证明具体根因。
- FileVault 启动前解锁、电源、网络、合盖、硬件和操作系统故障均不属于软件能够
  控制的范围。
