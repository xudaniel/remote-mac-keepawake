# Architecture

[English](ARCHITECTURE.md) | [简体中文](ARCHITECTURE.zh-CN.md)

Remote Mac KeepAwake is local-first. The optional Mac Pulse path is enabled
only when the operator explicitly installs the heartbeat reporter.

```mermaid
flowchart LR
  subgraph Mac[Remote Mac]
    KA[launchd + caffeinate\nverified idle-sleep assertion]
    HB[Heartbeat reporter\nminimal opt-in payload]
    NQ[Apple networkQuality\noptional and cached]
    KA --> HB
    NQ -. enabled by operator .-> HB
  end

  HB -->|HTTPS + ingest token| API[Private Mac Pulse API]
  API --> DB[(Retained D1 history)]
  Owner[Authenticated owner] -->|private identity session| UI[Mac Pulse dashboard]
  UI --> API
  Scheduler[External scheduler\noptional] -->|offline check| API
  API -. minimal state event .-> Webhook[Optional alert webhook]
```

## Trust boundaries

- KeepAwake runs locally and does not require Mac Pulse.
- Viewer identity and heartbeat ingestion use separate authorization paths.
- Heartbeats exclude hostname, username, IP address, serial number, location,
  webhook destination, and credentials.
- Absence of a heartbeat proves only that the external monitor has not received
  a recent sample; it does not prove a specific root cause.
- FileVault pre-boot unlock, power, network, closed-lid behavior, hardware, and
  operating-system failures remain outside software control.
