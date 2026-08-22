import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { healthSamples } from "../../../db/schema";
import { unauthorized, viewerAuthMode } from "../../../lib/auth";
import { viewerCorsPreflight, withViewerCors } from "../../../lib/cors";

const OFFLINE_AFTER_SECONDS = 90;
const EXPECTED_CHECK_IN_SECONDS = 60;
const STALE_AFTER_SECONDS = 75;

export async function GET(request: Request) {
  const viewerAuth = viewerAuthMode(request);
  if (!viewerAuth) return withViewerCors(request, unauthorized());

  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(healthSamples)
      .orderBy(desc(healthSamples.id))
      .limit(60);
  const latest = rows[0] ?? null;
  const now = Date.now();
  const received = latest ? Date.parse(`${latest.receivedAt.replace(" ", "T")}Z`) : 0;
  const ageSeconds = latest ? Math.max(0, Math.floor((now - received) / 1000)) : null;
  const online = ageSeconds !== null && ageSeconds <= OFFLINE_AFTER_SECONDS;
  const awake = Boolean(online && latest?.serviceState === "running" && latest.idleSleepPrevented);
  const overall = !online ? "offline" : !awake ? "unprotected" : ageSeconds !== null && ageSeconds > STALE_AFTER_SECONDS ? "stale" : "healthy";

    return withViewerCors(request, Response.json(
      {
        server_time: new Date(now).toISOString(),
        viewer_auth: viewerAuth,
        offline_after_seconds: OFFLINE_AFTER_SECONDS,
        expected_check_in_seconds: EXPECTED_CHECK_IN_SECONDS,
        age_seconds: ageSeconds,
        online,
        awake,
        overall,
        latest,
        history: rows.reverse().map((row) => ({
          receivedAt: row.receivedAt,
          batteryPercent: row.batteryPercent,
          idleSleepPrevented: row.idleSleepPrevented,
          health: row.health,
        })),
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    ));
  } catch {
    return withViewerCors(request, Response.json(
      { error: "Status storage is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    ));
  }
}

export async function OPTIONS(request: Request) {
  return viewerCorsPreflight(request);
}
