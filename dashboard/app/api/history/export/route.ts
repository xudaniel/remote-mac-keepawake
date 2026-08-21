import { getD1 } from "../../../../db";
import { unauthorized, viewerAuthMode } from "../../../../lib/auth";
import { historyWhere, parseHistoryBounds } from "../../../../lib/history";

const EXPORT_LIMIT = 50_000;

function csv(value: unknown) {
  if (value === null || value === undefined) return "";
  return `"${String(value).replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  if (!viewerAuthMode(request)) return unauthorized();
  const url = new URL(request.url);
  const bounds = parseHistoryBounds(url);
  if (!bounds) return Response.json({ error: "Invalid history range" }, { status: 400 });
  try {
    const d1 = getD1();
    const where = historyWhere(bounds);
    const result = await d1.prepare(`
      SELECT received_at, reported_at, health, service_state, idle_sleep_prevented,
             power_source, battery_percent, charging, lid_closed, network_checked,
             network_available, chrome_checked, chrome_running, version, mode
      FROM health_samples ${where.sql} ORDER BY id ASC LIMIT ?
    `).bind(...where.values, EXPORT_LIMIT + 1).all<Record<string, unknown>>();
    const rows = result.results ?? [];
    const truncated = rows.length > EXPORT_LIMIT;
    const exported = rows.slice(0, EXPORT_LIMIT);
    const columns = [
      "received_at", "reported_at", "health", "service_state", "idle_sleep_prevented",
      "power_source", "battery_percent", "charging", "lid_closed", "network_checked",
      "network_available", "chrome_checked", "chrome_running", "version", "mode",
    ];
    const output = [columns.join(","), ...exported.map((row) => columns.map((column) => csv(row[column])).join(","))].join("\n");
    return new Response(output, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="mac-pulse-history-${bounds.range}.csv"`,
        "Cache-Control": "no-store",
        "X-Export-Truncated": String(truncated),
      },
    });
  } catch {
    return Response.json({ error: "History export failed" }, { status: 503 });
  }
}

