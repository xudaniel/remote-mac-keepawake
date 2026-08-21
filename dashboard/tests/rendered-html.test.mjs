import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  return (await import(workerUrl.href)).default;
}

const context = {
  waitUntil() {},
  passThroughOnException() {},
};

test("renders the private Mac Pulse dashboard shell", async () => {
  const app = await worker();
  const response = await app.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    context,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Mac Pulse — Remote Mac Monitor<\/title>/);
  assert.match(html, /Mac Pulse/);
  assert.match(html, /打开 Mac 监控面板/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("checks separate view and ingest authorization before database access", async () => {
  const [statusRoute, heartbeatRoute, auth] = await Promise.all([
    readFile(new URL("../app/api/status/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/heartbeat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/auth.ts", import.meta.url), "utf8"),
  ]);
  assert.ok(statusRoute.indexOf("viewerAuthMode(request)") < statusRoute.indexOf("getDb()"));
  assert.ok(heartbeatRoute.indexOf('isAuthorized(request, "INGEST_TOKEN")') < heartbeatRoute.indexOf("getDb()"));
  assert.match(auth, /oai-authenticated-user-id/);
  assert.match(auth, /isAuthorized\(request, "VIEW_TOKEN"\)/);
  assert.match(statusRoute, /Cache-Control.*no-store/);
  assert.match(heartbeatRoute, /Payload too large/);
  assert.doesNotMatch(heartbeatRoute, /\.delete\(|\.offset\(288\)|lte\(/);
});

test("ships additive D1 migrations and no real secrets", async () => {
  const [initialMigration, featureMigration, speedMigration, deliveryMigration, example, hosting] = await Promise.all([
    readFile(new URL("../drizzle/0000_lumpy_susan_delgado.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_late_stranger.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0002_ambitious_lightspeed.sql", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_lush_grim_reaper.sql", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
  ]);
  assert.match(initialMigration, /CREATE TABLE .*health_samples/);
  assert.match(featureMigration, /CREATE TABLE .*alert_settings/);
  assert.match(featureMigration, /CREATE TABLE .*alert_events/);
  assert.match(featureMigration, /health_samples_received_at_idx/);
  assert.doesNotMatch(featureMigration, /DROP TABLE|DELETE FROM/i);
  assert.match(speedMigration, /internet_download_mbps/);
  assert.match(speedMigration, /internet_speed_measured_at/);
  assert.doesNotMatch(speedMigration, /DROP TABLE|DELETE FROM/i);
  assert.match(deliveryMigration, /sample_id/);
  assert.match(deliveryMigration, /UNIQUE INDEX/);
  assert.match(deliveryMigration, /reported_at_idx/);
  assert.doesNotMatch(deliveryMigration, /DROP TABLE|DELETE FROM/i);
  assert.match(example, /replace-with-a-long-random-secret/);
  assert.match(example, /ALERT_WEBHOOK_URL/);
  assert.match(hosting, /"d1": "DB"/);
  assert.doesNotMatch(example, /local-view-token|local-ingest-token/);
});

test("battery history exposes local timestamps and selectable samples", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Exact local timestamp/);
  assert.match(dashboard, /本地准确时间/);
  assert.match(dashboard, /timeZoneName: exact/);
  assert.match(dashboard, /aria-pressed=\{selected\}/);
  assert.match(dashboard, /dateTime=\{toIsoTimestamp/);
  assert.match(dashboard, /selectedSample\.reportedAt/);
  assert.match(styles, /\.history-axis/);
  assert.match(styles, /\.history-detail/);
});

test("remote internet speed includes cached measurements and an exact timestamp", async () => {
  const [dashboard, heartbeat, historyExport, health] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/heartbeat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/history/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/health.ts", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Internet speed/);
  assert.match(dashboard, /Last speed test — exact local time/);
  assert.match(dashboard, /Download \/ upload/);
  assert.match(heartbeat, /internetSpeedMeasuredAt/);
  assert.match(historyExport, /internet_speed_measured_at/);
  assert.match(health, /internet_speed_enabled \?\? false/);
});

test("heartbeat replay is idempotent and preserves observation time", async () => {
  const [heartbeat, health, history, dashboard] = await Promise.all([
    readFile(new URL("../app/api/heartbeat/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/health.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/history.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(heartbeat, /onConflictDoNothing/);
  assert.match(heartbeat, /duplicate: !isNewSample/);
  assert.match(heartbeat, /isCurrentSample/);
  assert.match(health, /sample_id/);
  assert.match(history, /reported_at >=/);
  assert.match(history, /reported_at <=/);
  assert.match(dashboard, /left\.reportedAt/);
});

test("implements paginated owner-only history lifecycle", async () => {
  const [historyRoute, exportRoute, historyLibrary] = await Promise.all([
    readFile(new URL("../app/api/history/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/history/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/history.ts", import.meta.url), "utf8"),
  ]);
  assert.match(historyRoute, /viewerAuthMode\(request\)/);
  assert.match(historyRoute, /next_cursor/);
  assert.match(historyRoute, /DELETE HISTORY/);
  assert.match(exportRoute, /EXPORT_LIMIT = 50_000/);
  assert.match(exportRoute, /X-Export-Truncated/);
  assert.match(historyLibrary, /"1h", "6h", "24h", "7d", "30d", "all", "custom"/);
});

test("alert payload is minimal and alert transitions are durable", async () => {
  const [alerts, route, migration] = await Promise.all([
    readFile(new URL("../lib/alerts.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/alerts/check/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_late_stranger.sql", import.meta.url), "utf8"),
  ]);
  assert.match(alerts, /product: "Mac Pulse"/);
  assert.match(alerts, /kind,\s*state,\s*severity,\s*occurred_at/);
  assert.doesNotMatch(alerts, /hostname|serial_number|username/);
  assert.match(route, /INGEST_TOKEN/);
  assert.match(migration, /delivery_error/);
});

test("dashboard includes actionable diagnostics and accessibility safeguards", async () => {
  const [dashboard, styles] = await Promise.all([
    readFile(new URL("../app/Dashboard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(dashboard, /Next expected check-in/);
  assert.match(dashboard, /Heartbeat is late/);
  assert.match(dashboard, /Copy safe diagnostics/);
  assert.match(dashboard, /Last successful delivery/);
  assert.match(dashboard, /Current observed state duration/);
  assert.match(dashboard, /aria-live="polite"/);
  assert.match(dashboard, /Not checked/);
  assert.match(styles, /min-width: 320px/);
  assert.match(styles, /min-height: 44px/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("core dashboard colors meet WCAG AA normal-text contrast", () => {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (hex) => {
    const value = Number.parseInt(hex.slice(1), 16);
    return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
  };
  const contrast = (first, second) => {
    const values = [luminance(first), luminance(second)].sort((left, right) => right - left);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  for (const foreground of ["#f1faf6", "#a9bdb6", "#70eabb", "#ffc27f", "#ff9e87"]) {
    assert.ok(contrast(foreground, "#07100f") >= 4.5, `${foreground} must meet 4.5:1 on the page background`);
  }
});

test("documents unbounded application-level heartbeat retention", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  const normalized = readme.replace(/\s+/g, " ");
  assert.match(normalized, /does not automatically delete accepted heartbeat samples/);
  assert.match(normalized, /hosting provider's capacity and lifecycle limits/);
  assert.doesNotMatch(readme, /retains only the latest 288 samples/);
});
