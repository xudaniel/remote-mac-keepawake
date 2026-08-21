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
  chrome_checked: number;
  chrome_running: boolean | null;
};

const healthStates = new Set(["healthy", "unavailable", "degraded"]);
const modes = new Set(["user", "system"]);

function nullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

export function parseIncomingHealth(value: unknown): IncomingHealth | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const timestamp = typeof item.timestamp === "string" ? item.timestamp : "";
  const battery = item.battery_percent;
  const pid = item.pid;

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
    !(item.chrome_checked === 0 || item.chrome_checked === 1) ||
    !nullableBoolean(item.chrome_running)
  ) return null;

  return item as IncomingHealth;
}
