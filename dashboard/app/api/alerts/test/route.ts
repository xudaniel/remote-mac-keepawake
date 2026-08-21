import { sendTestAlert, webhookConfigured } from "../../../../lib/alerts";
import { unauthorized, viewerAuthMode } from "../../../../lib/auth";

export async function POST(request: Request) {
  if (!viewerAuthMode(request)) return unauthorized();
  if (!webhookConfigured()) {
    return Response.json({ error: "ALERT_WEBHOOK_URL is not configured" }, { status: 409 });
  }
  const result = await sendTestAlert();
  return Response.json(result, { status: result.delivered ? 200 : 502, headers: { "Cache-Control": "no-store" } });
}

