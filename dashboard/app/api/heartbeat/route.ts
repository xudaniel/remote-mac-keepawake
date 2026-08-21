import { getDb } from "../../../db";
import { healthSamples } from "../../../db/schema";
import { isAuthorized, unauthorized } from "../../../lib/auth";
import { processHeartbeatAlerts } from "../../../lib/alerts";
import { parseIncomingHealth } from "../../../lib/health";

export async function POST(request: Request) {
  if (!isAuthorized(request, "INGEST_TOKEN")) return unauthorized();

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return Response.json({ error: "Payload too large" }, { status: 413 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const item = parseIncomingHealth(raw);
  if (!item) {
    return Response.json({ error: "Invalid health payload" }, { status: 422 });
  }

  try {
    const db = getDb();
    await db.insert(healthSamples).values({
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
      charging: item.charging,
      lidClosed: item.lid_closed,
      networkChecked: item.network_checked === 1,
      networkAvailable: item.network_available,
      chromeChecked: item.chrome_checked === 1,
      chromeRunning: item.chrome_running,
    });

    try {
      await processHeartbeatAlerts(item);
    } catch {
      // A delivery/configuration failure must never reject a valid heartbeat.
    }

    return Response.json(
      { accepted: true },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { error: "Heartbeat storage is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
