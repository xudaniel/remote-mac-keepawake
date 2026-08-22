import { getDb } from "../../../db";
import { healthSamples } from "../../../db/schema";
import { authorizeHeartbeat, unauthorized } from "../../../lib/auth";
import { processHeartbeatAlerts } from "../../../lib/alerts";
import { parseIncomingHealth } from "../../../lib/health";

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let rawBody = "";
  let raw: unknown;
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 16_384) {
      return Response.json({ error: "Payload too large" }, { status: 413 });
    }
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    const authorization = await authorizeHeartbeat(request, rawBody);
    if (!authorization.authorized) return unauthorized();
  } catch {
    return Response.json({ error: "Heartbeat authentication is temporarily unavailable" }, { status: 503 });
  }
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const item = parseIncomingHealth(raw);
  if (!item) {
    return Response.json({ error: "Invalid health payload" }, { status: 422 });
  }
  const signedSampleId = request.headers.get("x-mac-pulse-sample-id")?.trim();
  if (signedSampleId && signedSampleId !== item.sample_id) {
    return Response.json({ error: "Invalid health payload" }, { status: 422 });
  }

  try {
    const db = getDb();
    const inserted = await db.insert(healthSamples).values({
      sampleId: item.sample_id,
      reportedAt: item.timestamp,
      version: item.version,
      health: item.health,
      mode: item.mode,
      installed: item.installed,
      serviceState: item.service_state,
      pid: item.pid,
      idleSleepPrevented: item.idle_sleep_prevented,
      powerSource: item.power_source,
      batteryPercent: item.battery_percent,
      batteryCondition: item.battery_condition,
      batteryCycleCount: item.battery_cycle_count,
      batteryDesignCapacityMah: item.battery_design_capacity_mah,
      batteryFullChargeCapacityMah: item.battery_full_charge_capacity_mah,
      batteryHealthPercent: item.battery_health_percent,
      thermalState: item.thermal_state,
      charging: item.charging,
      lidClosed: item.lid_closed,
      networkChecked: item.network_checked === 1,
      networkAvailable: item.network_available,
      internetSpeedEnabled: item.internet_speed_enabled,
      internetDownloadMbps: item.internet_download_mbps,
      internetUploadMbps: item.internet_upload_mbps,
      internetLatencyMs: item.internet_latency_ms,
      internetResponsivenessRpm: item.internet_responsiveness_rpm,
      internetSpeedMeasuredAt: item.internet_speed_measured_at,
      networkDiagnosticsEnabled: item.network_diagnostics_enabled,
      networkRouteAvailable: item.network_route_available,
      networkGatewayReachable: item.network_gateway_reachable,
      networkDnsAvailable: item.network_dns_available,
      networkHttpsAvailable: item.network_https_available,
      networkIngestReachable: item.network_ingest_reachable,
      networkGatewayLatencyMs: item.network_gateway_latency_ms,
      networkGatewayJitterMs: item.network_gateway_jitter_ms,
      networkGatewayPacketLossPercent: item.network_gateway_packet_loss_percent,
      networkFault: item.network_fault,
      networkDiagnosticsMeasuredAt: item.network_diagnostics_measured_at,
      chromeChecked: item.chrome_checked === 1,
      chromeRunning: item.chrome_running,
    }).onConflictDoNothing({ target: healthSamples.sampleId }).returning({ id: healthSamples.id });

    const isNewSample = inserted.length > 0;
    const isCurrentSample = Math.abs(Date.now() - Date.parse(item.timestamp)) <= 5 * 60 * 1_000;
    if (isNewSample && isCurrentSample) {
      try {
        await processHeartbeatAlerts(item);
      } catch {
        // A delivery/configuration failure must never reject a valid heartbeat.
      }
    }

    return Response.json(
      { accepted: true, duplicate: !isNewSample },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Heartbeat storage is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
