# 架构说明

[English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md)

Remote Mac KeepAwake 默认完全在本机运行。只有运维者显式安装 heartbeat reporter
后，才会启用可选的 Mac Pulse 路径。

```mermaid
flowchart LR
  subgraph Mac[远程 Mac]
    KA[launchd + caffeinate\n已验证防闲置睡眠 assertion]
    HB[Heartbeat reporter\n最小化且显式启用的 payload]
    NQ[Apple networkQuality\n可选并使用缓存]
    KA --> HB
    NQ -. 运维者显式启用 .-> HB
  end

  HB -->|HTTPS + ingest token| API[私有 Mac Pulse API]
  API --> DB[(完整保留的 D1 历史)]
  Owner[已认证所有者] -->|私有身份会话| UI[Mac Pulse Dashboard]
  UI --> API
  Scheduler[外部 scheduler\n可选] -->|离线检查| API
  API -. 最小化状态事件 .-> Webhook[可选提醒 webhook]
```

## 信任边界

- KeepAwake 在本机运行，不依赖 Mac Pulse。
- 查看者身份与 heartbeat 上传使用相互独立的授权路径。
- Heartbeat 不包含电脑名称、用户名、IP 地址、序列号、位置、webhook 目标或密钥。
- 没有收到 heartbeat 只能证明外部监控端没有收到近期样本，不能证明具体根因。
- FileVault 启动前解锁、电源、网络、合盖、硬件和操作系统故障均不属于软件能够
  控制的范围。
