import { getD1 } from "../../../db";
import { unauthorized, viewerAuthMode } from "../../../lib/auth";
import { historyWhere, parseCursor, parseHistoryBounds, parsePageLimit } from "../../../lib/history";

type RawSample = {
  id: number;
  received_at: string;
  reported_at: string;
  version: string;
  health: string;
  mode: string;
  installed: number;
  service_state: string;
  pid: number | null;
  idle_sleep_prevented: number;
  power_source: string;
  battery_percent: number | null;
  battery_condition: string | null;
  battery_cycle_count: number | null;
  battery_design_capacity_mah: number | null;
  battery_full_charge_capacity_mah: number | null;
  battery_health_percent: number | null;
  thermal_state: string | null;
  charging: number | null;
  lid_closed: number | null;
  network_checked: number;
  network_available: number | null;
  internet_speed_enabled: number;
  internet_download_mbps: number | null;
  internet_upload_mbps: number | null;
  internet_latency_ms: number | null;
  internet_responsiveness_rpm: number | null;
  internet_speed_measured_at: string | null;
  network_diagnostics_enabled: number;
  network_route_available: number | null;
  network_gateway_reachable: number | null;
  network_dns_available: number | null;
  network_https_available: number | null;
  network_ingest_reachable: number | null;
  network_gateway_latency_ms: number | null;
  network_gateway_jitter_ms: number | null;
  network_gateway_packet_loss_percent: number | null;
  network_fault: string | null;
  network_diagnostics_measured_at: string | null;
  chrome_checked: number;
  chrome_running: number | null;
};

type RawSummary = {
  total: number;
  first_received_at: string | null;
  last_received_at: string | null;
  protected_samples: number;
  min_battery: number | null;
  max_battery: number | null;
};

function nullableBoolean(value: number | null) {
  return value === null ? null : Boolean(value);
}

function mapSample(row: RawSample) {
  return {
    id: row.id,
    receivedAt: row.received_at,
    reportedAt: row.reported_at,
    version: row.version,
    health: row.health,
    mode: row.mode,
    installed: Boolean(row.installed),
    serviceState: row.service_state,
    pid: row.pid,
    idleSleepPrevented: Boolean(row.idle_sleep_prevented),
    powerSource: row.power_source,
    batteryPercent: row.battery_percent,
    batteryCondition: row.battery_condition,
    batteryCycleCount: row.battery_cycle_count,
    batteryDesignCapacityMah: row.battery_design_capacity_mah,
    batteryFullChargeCapacityMah: row.battery_full_charge_capacity_mah,
    batteryHealthPercent: row.battery_health_percent,
    thermalState: row.thermal_state,
    charging: nullableBoolean(row.charging),
    lidClosed: nullableBoolean(row.lid_closed),
    networkChecked: Boolean(row.network_checked),
    networkAvailable: nullableBoolean(row.network_available),
    internetSpeedEnabled: Boolean(row.internet_speed_enabled),
    internetDownloadMbps: row.internet_download_mbps,
    internetUploadMbps: row.internet_upload_mbps,
    internetLatencyMs: row.internet_latency_ms,
    internetResponsivenessRpm: row.internet_responsiveness_rpm,
    internetSpeedMeasuredAt: row.internet_speed_measured_at,
    networkDiagnosticsEnabled: Boolean(row.network_diagnostics_enabled),
    networkRouteAvailable: nullableBoolean(row.network_route_available),
    networkGatewayReachable: nullableBoolean(row.network_gateway_reachable),
    networkDnsAvailable: nullableBoolean(row.network_dns_available),
    networkHttpsAvailable: nullableBoolean(row.network_https_available),
    networkIngestReachable: nullableBoolean(row.network_ingest_reachable),
    networkGatewayLatencyMs: row.network_gateway_latency_ms,
    networkGatewayJitterMs: row.network_gateway_jitter_ms,
    networkGatewayPacketLossPercent: row.network_gateway_packet_loss_percent,
    networkFault: row.network_fault,
    networkDiagnosticsMeasuredAt: row.network_diagnostics_measured_at,
    chromeChecked: Boolean(row.chrome_checked),
    chromeRunning: nullableBoolean(row.chrome_running),
  };
}

export async function GET(request: Request) {
  if (!viewerAuthMode(request)) return unauthorized();
  const url = new URL(request.url);
  const bounds = parseHistoryBounds(url);
  const limit = parsePageLimit(url.searchParams.get("limit"));
  const cursor = parseCursor(url.searchParams.get("cursor"));
  if (!bounds || limit === null || Number.isNaN(cursor)) {
    return Response.json({ error: "Invalid history range, cursor, or limit" }, { status: 400 });
  }

  try {
    const d1 = getD1();
    const pageWhere = historyWhere(bounds, cursor);
    const rangeWhere = historyWhere(bounds);
    const page = await d1.prepare(`
      SELECT * FROM health_samples ${pageWhere.sql}
      ORDER BY id DESC LIMIT ?
    `).bind(...pageWhere.values, limit + 1).all<RawSample>();
    const summary = await d1.prepare(`
      SELECT COUNT(*) AS total, MIN(reported_at) AS first_received_at,
             MAX(reported_at) AS last_received_at,
             COALESCE(SUM(CASE WHEN idle_sleep_prevented = 1 AND service_state = 'running' THEN 1 ELSE 0 END), 0) AS protected_samples,
             MIN(battery_percent) AS min_battery, MAX(battery_percent) AS max_battery
      FROM health_samples ${rangeWhere.sql}
    `).bind(...rangeWhere.values).first<RawSummary>();
    const outage = await d1.prepare(`
      WITH ordered AS (
        SELECT reported_at AS sample_at,
               LAG(reported_at) OVER (ORDER BY reported_at, id) AS previous_sample_at
        FROM health_samples ${rangeWhere.sql}
      )
      SELECT COALESCE(SUM(CASE
        WHEN previous_sample_at IS NOT NULL AND
             strftime('%s', sample_at) - strftime('%s', previous_sample_at) > 90
        THEN strftime('%s', sample_at) - strftime('%s', previous_sample_at) - 60
        ELSE 0 END), 0) AS outage_seconds
      FROM ordered
    `).bind(...rangeWhere.values).first<{ outage_seconds: number }>();

    const rawRows = page.results ?? [];
    const hasMore = rawRows.length > limit;
    const rows = rawRows.slice(0, limit);
    const items = rows.map(mapSample).sort((left: ReturnType<typeof mapSample>, right: ReturnType<typeof mapSample>) =>
      Date.parse(left.reportedAt) - Date.parse(right.reportedAt) || left.id - right.id);
    const total = Number(summary?.total ?? 0);
    const firstMs = summary?.first_received_at ? Date.parse(summary.first_received_at) : 0;
    const lastMs = summary?.last_received_at ? Date.parse(summary.last_received_at) : 0;
    const observedSeconds = Math.max(0, Math.floor((lastMs - firstMs) / 1_000));
    const outageSeconds = Math.min(observedSeconds, Number(outage?.outage_seconds ?? 0));

    return Response.json({
      range: bounds.range,
      from: bounds.from,
      to: bounds.to,
      items,
      next_cursor: hasMore ? rows.at(-1)?.id ?? null : null,
      summary: {
        total_samples: total,
        first_received_at: summary?.first_received_at ?? null,
        last_received_at: summary?.last_received_at ?? null,
        protected_samples: Number(summary?.protected_samples ?? 0),
        min_battery: summary?.min_battery ?? null,
        max_battery: summary?.max_battery ?? null,
        outage_seconds: outageSeconds,
        uptime_percent: observedSeconds > 0 ? Math.max(0, (observedSeconds - outageSeconds) / observedSeconds * 100) : total ? 100 : null,
        approximate_storage_bytes: total * 512,
        storage_is_estimate: true,
      },
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return Response.json({ error: "History storage is temporarily unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  if (!viewerAuthMode(request)) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "DELETE HISTORY") {
    return Response.json({ error: "Type DELETE HISTORY to confirm" }, { status: 422 });
  }
  try {
    const d1 = getD1();
    const before = await d1.prepare("SELECT COUNT(*) AS total FROM health_samples").first<{ total: number }>();
    await d1.prepare("DELETE FROM health_samples").run();
    return Response.json({ deleted_samples: Number(before?.total ?? 0) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "History deletion failed" }, { status: 503 });
  }
}
