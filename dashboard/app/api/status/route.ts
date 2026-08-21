import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { healthSamples } from "../../../db/schema";
import { unauthorized, viewerAuthMode } from "../../../lib/auth";

const OFFLINE_AFTER_SECONDS = 90;

export async function GET(request: Request) {
  const viewerAuth = viewerAuthMode(request);
  if (!viewerAuth) return unauthorized();

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
  const overall = !online ? "offline" : awake ? "healthy" : "unprotected";

    return Response.json(
      {
        server_time: new Date(now).toISOString(),
        viewer_auth: viewerAuth,
        offline_after_seconds: OFFLINE_AFTER_SECONDS,
        expected_check_in_seconds: 60,
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
    );
  } catch {
    return Response.json(
      { error: "Status storage is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
