export type IncomingHealth = {
  timestamp: string;
  version: string;
  health: "healthy" | "unavailable" | "degraded";
  mode: "user" | "system";
  installed: boolean;
  service_state: string;
  pid: number | null;
  idle_sleep_prevented: boolean;
  power_source: string;
  battery_percent: number | null;
  charging: boolean | null;
  lid_closed: boolean | null;
  network_checked: number;
  network_available: boolean | null;
  internet_speed_enabled: boolean;
  internet_download_mbps: number | null;
  internet_upload_mbps: number | null;
  internet_latency_ms: number | null;
  internet_responsiveness_rpm: number | null;
  internet_speed_measured_at: string | null;
  chrome_checked: number;
  chrome_running: boolean | null;
};

const healthStates = new Set(["healthy", "unavailable", "degraded"]);
const modes = new Set(["user", "system"]);

function nullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

function nullableNumber(value: unknown, maximum: number): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum);
}

export function parseIncomingHealth(value: unknown): IncomingHealth | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const timestamp = typeof item.timestamp === "string" ? item.timestamp : "";
  const battery = item.battery_percent;
  const pid = item.pid;
  const internetSpeedEnabled = item.internet_speed_enabled ?? false;
  const internetDownloadMbps = item.internet_download_mbps ?? null;
  const internetUploadMbps = item.internet_upload_mbps ?? null;
  const internetLatencyMs = item.internet_latency_ms ?? null;
  const internetResponsivenessRpm = item.internet_responsiveness_rpm ?? null;
  const internetSpeedMeasuredAt = item.internet_speed_measured_at ?? null;
  const hasSpeedMeasurement = internetSpeedMeasuredAt !== null || internetDownloadMbps !== null ||
    internetUploadMbps !== null || internetLatencyMs !== null || internetResponsivenessRpm !== null;

  if (
    !timestamp || Number.isNaN(Date.parse(timestamp)) ||
    typeof item.version !== "string" || item.version.length > 32 ||
    typeof item.health !== "string" || !healthStates.has(item.health) ||
    typeof item.mode !== "string" || !modes.has(item.mode) ||
    typeof item.installed !== "boolean" ||
    typeof item.service_state !== "string" || item.service_state.length > 64 ||
    !(pid === null || (Number.isInteger(pid) && Number(pid) > 0)) ||
    typeof item.idle_sleep_prevented !== "boolean" ||
    typeof item.power_source !== "string" || item.power_source.length > 64 ||
    !(battery === null || (Number.isInteger(battery) && Number(battery) >= 0 && Number(battery) <= 100)) ||
    !nullableBoolean(item.charging) || !nullableBoolean(item.lid_closed) ||
    !(item.network_checked === 0 || item.network_checked === 1) ||
    !nullableBoolean(item.network_available) ||
    typeof internetSpeedEnabled !== "boolean" ||
    !nullableNumber(internetDownloadMbps, 100_000) ||
    !nullableNumber(internetUploadMbps, 100_000) ||
    !nullableNumber(internetLatencyMs, 60_000) ||
    !nullableNumber(internetResponsivenessRpm, 1_000_000) ||
    !(internetSpeedMeasuredAt === null || (typeof internetSpeedMeasuredAt === "string" &&
      !Number.isNaN(Date.parse(internetSpeedMeasuredAt)))) ||
    (hasSpeedMeasurement && (!internetSpeedEnabled || internetDownloadMbps === null ||
      internetUploadMbps === null || internetLatencyMs === null ||
      internetResponsivenessRpm === null || internetSpeedMeasuredAt === null)) ||
    !(item.chrome_checked === 0 || item.chrome_checked === 1) ||
    !nullableBoolean(item.chrome_running)
  ) return null;

  return {
    ...item,
    internet_speed_enabled: internetSpeedEnabled,
    internet_download_mbps: internetDownloadMbps,
    internet_upload_mbps: internetUploadMbps,
    internet_latency_ms: internetLatencyMs,
    internet_responsiveness_rpm: internetResponsivenessRpm,
    internet_speed_measured_at: internetSpeedMeasuredAt,
  } as IncomingHealth;
}
