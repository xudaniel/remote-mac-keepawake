# Mac Pulse Dashboard

Mac Pulse is the optional remote dashboard for Remote Mac KeepAwake. It records
minimal health heartbeats outside the monitored Mac, so a stale heartbeat can
indicate that the Mac is asleep, offline, or powered down.

## GitHub Pages live viewer

The public static viewer is deployed from `pages/` to
`https://xudaniel.github.io/remote-mac-keepawake/`. Its default mode uses only
synthetic data. Connected mode makes read-only requests to `/api/status` and
`/api/history`; it does not expose history deletion or heartbeat ingestion.

To authorize the exact GitHub Pages origin, configure the dashboard runtime:

```text
PUBLIC_VIEWER_ORIGIN=https://xudaniel.github.io
```

Then enter the dashboard origin and its separate `VIEW_TOKEN` in the viewer.
The viewer stores credentials only in the current tab's `sessionStorage`, uses
no analytics or third-party scripts, and never adds credentials to a URL. An
optional hosting access token can be sent in `OAI-Sites-Authorization` when the
edge layer supports authenticated cross-origin preflight. Never enter the
heartbeat ingest/signing key in the public viewer. Use a trusted browser and
disconnect when finished.

## What the dashboard shows

- an actionable connection summary, exact local heartbeat timestamp, age, and
  next expected check-in;
- verified idle-sleep assertion and launchd service state;
- battery percentage, charging state, power source, condition, cycle count,
  capacity-derived health estimate, and macOS thermal-pressure state;
- opt-in internet download, upload, idle-latency, and responsiveness results
  measured on the remote Mac, with an exact measurement timestamp;
- opt-in route, gateway, DNS, public HTTPS, and ingest reachability diagnostics,
  plus gateway latency, jitter, packet loss, a normalized fault category, and
  an exact measurement timestamp;
- explicit checked, passed, failed, and unknown diagnostics for KeepAwake,
  power, network, and Chrome Remote Desktop;
- complete retained heartbeat history with 1-hour through all-time and custom
  ranges, cursor pagination, exact sample timestamps, detected transitions,
  inferred uptime/outage time, CSV export, and an explicit deletion workflow;
- an optional alert center for offline, low-battery, battery-health, thermal,
  power, KeepAwake, network, and Chrome Remote Desktop changes and recoveries.

The interface supports English and Simplified Chinese and refreshes every ten
seconds. A heartbeat older than 90 seconds is considered offline.

The reporter uses Apple's built-in `networkQuality` only when the operator
enables it. Measurements are cached between heartbeats and default to a six-hour
interval because the test transfers data and may briefly compete with remote
control. The dashboard never tests the viewer's browser connection and presents
old results with their actual timestamp and age.
The reachability probe URL is operator-configurable and remains only in the
reporter's protected local configuration; it is never transmitted as history.
Diagnostic subprocesses use reduced CPU priority and strict timeouts.

## Access, privacy, and security

The production site is owner-only. Its Sign in with ChatGPT session is the
viewer authorization, so the owner is not asked for a second viewing key.
`VIEW_TOKEN` remains a local-development and API-tool fallback and stays in the
current browser tab (`sessionStorage`), never in the URL. Heartbeat ingestion
uses a separate signing key and cannot use the owner session. Every upload uses
an HMAC-SHA-256 signature over a transport timestamp, key ID, sample ID, and
body digest. The server enforces a five-minute replay window, supports current,
next, and previous rotation slots, and rate-limits failed authentication without
retaining source IP addresses. Production accepts bearer-only ingestion only
when `ALLOW_LEGACY_INGEST_BEARER=1` is explicitly enabled for migration.

Heartbeats do not contain hostname, username, IP address, serial number,
location, webhook URL, or credentials. Mac Pulse does not automatically delete
accepted heartbeat samples; they remain in the site's D1 database until the
owner removes the data or the site. Storage is still subject to the hosting
provider's capacity and lifecycle limits. The reporter is opt-in and stores
its ingest token in a mode-`0600` local file.

The reporter also writes every sample atomically to a private local outbox
before upload. Failed samples are retried and replayed after recovery, while a
random sample ID makes server ingestion idempotent. Replayed samples retain
their original observation timestamp, and stale replay never triggers a fresh
alert. `remote-mac-heartbeat status` exposes the queue depth and last successful
delivery. Uninstall preserves queued samples but removes their credentials.

For an owner-only Sites deployment, its separate automation bypass token is
also stored in a mode-`0600` file and sent only in the Sites authorization
header.

Never publish production secrets in Git, screenshots, issue comments, or shell
history.

## Alerts

Set the optional server-side `ALERT_WEBHOOK_URL` secret to an HTTPS endpoint,
optionally set `ALERT_FALLBACK_WEBHOOK_URL` and `SCHEDULER_CANARY_URL`, then
enable alert rules in the owner dashboard. The outbound body is deliberately
minimal: product, alert kind, state, severity, and occurrence time. It excludes
device identity, IP address, battery details, PID, and secrets.

Heartbeat arrivals detect low battery, battery health, thermal pressure,
battery power, KeepAwake, network, Chrome Remote Desktop, and recoveries. A
Cloudflare Cron Trigger invokes the Worker every minute so it can detect an
offline Mac without relying on the Mac itself. A D1 lease prevents duplicate
runs; temporary delivery failures use bounded exponential backoff and a
persistent retry queue before optional fallback delivery. The dashboard exposes
scheduler health and delivery attempts instead of implying an alert was sent.
Battery-health alerting has configurable absolute and rapid-drop thresholds;
non-critical thermal pressure is debounced across two consecutive samples.

## History lifecycle

History queries are range-bounded and cursor-paginated so “All” does not create
an unbounded browser response. CSV export is owner-only and returns at most
50,000 rows per request; narrow the range if the response is marked truncated.
The dashboard estimates storage at 512 bytes per sample and labels that value as
an estimate. Deleting history requires typing `DELETE HISTORY` exactly and is
irreversible. Internet speed fields and timestamps use the same retention,
pagination, export, and deletion lifecycle, as do hardware and network
diagnostic fields with their exact observation timestamps.

## Local development

Copy `.env.example` to `.env.local`, choose two different secrets, optionally
set an alert webhook, and run:

```bash
npm ci
npm run dev
npm test
```

Database changes use reviewed, sequential SQL files in `drizzle/`. Add the next
numbered migration, update `db/schema.ts`, and extend the migration test. The
repository intentionally does not install a schema-generator CLI, keeping the
development dependency surface smaller while the migration test protects old
history.

For the bundled local preview defaults only, use `local-view-token` and
`local-ingest-token`. Production refuses to use these defaults.
