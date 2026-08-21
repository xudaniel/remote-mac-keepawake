import { getD1 } from "../../../db";
import { getAlertSettings, saveAlertSettings, webhookConfigured } from "../../../lib/alerts";
import { unauthorized, viewerAuthMode } from "../../../lib/auth";

function boolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

export async function GET(request: Request) {
  if (!viewerAuthMode(request)) return unauthorized();
  try {
    const [settings, events] = await Promise.all([
      getAlertSettings(),
      getD1().prepare(`
        SELECT id, created_at, kind, state, severity, message, delivered, delivery_error
        FROM alert_events ORDER BY id DESC LIMIT 30
      `).all(),
    ]);
    return Response.json({
      settings,
      webhook_configured: webhookConfigured(),
      events: events.results ?? [],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Alert settings are temporarily unavailable" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  if (!viewerAuthMode(request)) return unauthorized();
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const offline = Number(body.offline_after_seconds);
  const battery = Number(body.battery_threshold);
  if (
    !boolean(body.enabled) || !Number.isInteger(offline) || offline < 90 || offline > 3_600 ||
    !Number.isInteger(battery) || battery < 5 || battery > 90 ||
    !boolean(body.alert_keepawake) || !boolean(body.alert_power) ||
    !boolean(body.alert_network) || !boolean(body.alert_chrome)
  ) return Response.json({ error: "Invalid alert settings" }, { status: 422 });

  try {
    const settings = await saveAlertSettings({
      enabled: body.enabled,
      offline_after_seconds: offline,
      battery_threshold: battery,
      alert_keepawake: body.alert_keepawake,
      alert_power: body.alert_power,
      alert_network: body.alert_network,
      alert_chrome: body.alert_chrome,
    });
    return Response.json({ settings, webhook_configured: webhookConfigured() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Alert settings could not be saved" }, { status: 503 });
  }
}

