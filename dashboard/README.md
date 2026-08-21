# Mac Pulse Dashboard

Mac Pulse is the optional remote dashboard for Remote Mac KeepAwake. It records
minimal health heartbeats outside the monitored Mac, so a stale heartbeat can
indicate that the Mac is asleep, offline, or powered down.

## What the dashboard shows

- an actionable connection summary, exact local heartbeat timestamp, age, and
  next expected check-in;
- verified idle-sleep assertion and launchd service state;
- battery percentage, charging state, and power source;
- explicit checked, passed, failed, and unknown diagnostics for KeepAwake,
  power, network, and Chrome Remote Desktop;
- complete retained heartbeat history with 1-hour through all-time and custom
  ranges, cursor pagination, exact sample timestamps, detected transitions,
  inferred uptime/outage time, CSV export, and an explicit deletion workflow;
- an optional alert center for offline, low-battery, power, KeepAwake, network,
  and Chrome Remote Desktop state changes and recoveries.

The interface supports English and Simplified Chinese and refreshes every ten
seconds. A heartbeat older than 90 seconds is considered offline.

## Access, privacy, and security

The production site is owner-only. Its Sign in with ChatGPT session is the
viewer authorization, so the owner is not asked for a second viewing key.
`VIEW_TOKEN` remains a local-development and API-tool fallback and stays in the
current browser tab (`sessionStorage`), never in the URL. Heartbeat ingestion
uses a separate `INGEST_TOKEN` and cannot use the owner session.

Heartbeats do not contain hostname, username, IP address, serial number,
location, webhook URL, or credentials. Mac Pulse does not automatically delete
accepted heartbeat samples; they remain in the site's D1 database until the
owner removes the data or the site. Storage is still subject to the hosting
provider's capacity and lifecycle limits. The reporter is opt-in and stores
its ingest token in a mode-`0600` local file.
For an owner-only Sites deployment, its separate automation bypass token is
also stored in a mode-`0600` file and sent only in the Sites authorization
header.

Never publish production secrets in Git, screenshots, issue comments, or shell
history.

## Alerts

Set the optional server-side `ALERT_WEBHOOK_URL` secret to an HTTPS endpoint,
then enable alert rules in the owner dashboard. The outbound body is deliberately
minimal: product, alert kind, state, severity, and occurrence time. It excludes
device identity, IP address, battery details, PID, and secrets.

Heartbeat arrivals can detect low battery, battery power, KeepAwake, network,
Chrome Remote Desktop, and recovery transitions. Reliable offline alerts also
need an external scheduler to POST to `/api/alerts/check` with the ingest bearer
token: an offline Mac cannot report its own outage. A missing webhook or
scheduler is shown as configuration state rather than reported as working.

## History lifecycle

History queries are range-bounded and cursor-paginated so “All” does not create
an unbounded browser response. CSV export is owner-only and returns at most
50,000 rows per request; narrow the range if the response is marked truncated.
The dashboard estimates storage at 256 bytes per sample and labels that value as
an estimate. Deleting history requires typing `DELETE HISTORY` exactly and is
irreversible.

## Local development

Copy `.env.example` to `.env.local`, choose two different secrets, optionally
set an alert webhook, generate the D1 migration after schema changes, and run:

```bash
npm ci
npm run dev
npm test
```

For the bundled local preview defaults only, use `local-view-token` and
`local-ingest-token`. Production refuses to use these defaults.
