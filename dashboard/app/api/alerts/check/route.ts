import { processOfflineAlert } from "../../../../lib/alerts";
import { isAuthorized, unauthorized } from "../../../../lib/auth";

export async function POST(request: Request) {
  if (!isAuthorized(request, "INGEST_TOKEN")) return unauthorized();
  try {
    return Response.json(await processOfflineAlert(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Offline alert check failed" }, { status: 503 });
  }
}

