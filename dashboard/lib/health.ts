export type IncomingHealth = {
  sample_id: string | null;
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
  battery_condition: "normal" | "service-recommended" | "unknown" | null;
  battery_cycle_count: number | null;
  battery_design_capacity_mah: number | null;
  battery_full_charge_capacity_mah: number | null;
  battery_health_percent: number | null;
  thermal_state: "nominal" | "fair" | "serious" | "critical" | "unknown" | null;
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
  network_diagnostics_enabled: boolean;
  network_route_available: boolean | null;
  network_gateway_reachable: boolean | null;
  network_dns_available: boolean | null;
  network_https_available: boolean | null;
  network_ingest_reachable: boolean | null;
  network_gateway_latency_ms: number | null;
  network_gateway_jitter_ms: number | null;
  network_gateway_packet_loss_percent: number | null;
  network_fault: "none" | "local-network" | "dns" | "internet" | "dashboard-ingest" | "unknown" | null;
  network_diagnostics_measured_at: string | null;
  chrome_checked: number;
  chrome_running: boolean | null;
};

const healthStates = new Set(["healthy", "unavailable", "degraded"]);
const modes = new Set(["user", "system"]);
const batteryConditions = new Set(["normal", "service-recommended", "unknown"]);
const thermalStates = new Set(["nominal", "fair", "serious", "critical", "unknown"]);
const networkFaults = new Set(["none", "local-network", "dns", "internet", "dashboard-ingest", "unknown"]);

function nullableBoolean(value: unknown): value is boolean | null {
  return value === null || typeof value === "boolean";
}

function nullableNumber(value: unknown, maximum: number): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum);
}

export function parseIncomingHealth(value: unknown): IncomingHealth | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Record<string, unknown>;
  const sampleId = item.sample_id ?? null;
  const timestamp = typeof item.timestamp === "string" ? item.timestamp : "";
  const battery = item.battery_percent;
  const pid = item.pid;
  const internetSpeedEnabled = item.internet_speed_enabled ?? false;
  const internetDownloadMbps = item.internet_download_mbps ?? null;
  const internetUploadMbps = item.internet_upload_mbps ?? null;
  const internetLatencyMs = item.internet_latency_ms ?? null;
  const internetResponsivenessRpm = item.internet_responsiveness_rpm ?? null;
  const internetSpeedMeasuredAt = item.internet_speed_measured_at ?? null;
  const batteryCondition = item.battery_condition ?? null;
  const batteryCycleCount = item.battery_cycle_count ?? null;
  const batteryDesignCapacityMah = item.battery_design_capacity_mah ?? null;
  const batteryFullChargeCapacityMah = item.battery_full_charge_capacity_mah ?? null;
  const batteryHealthPercent = item.battery_health_percent ?? null;
  const thermalState = item.thermal_state ?? null;
  const networkDiagnosticsEnabled = item.network_diagnostics_enabled ?? false;
  const networkRouteAvailable = item.network_route_available ?? null;
  const networkGatewayReachable = item.network_gateway_reachable ?? null;
  const networkDnsAvailable = item.network_dns_available ?? null;
  const networkHttpsAvailable = item.network_https_available ?? null;
  const networkIngestReachable = item.network_ingest_reachable ?? null;
  const networkGatewayLatencyMs = item.network_gateway_latency_ms ?? null;
  const networkGatewayJitterMs = item.network_gateway_jitter_ms ?? null;
  const networkGatewayPacketLossPercent = item.network_gateway_packet_loss_percent ?? null;
  const networkFault = item.network_fault ?? null;
  const networkDiagnosticsMeasuredAt = item.network_diagnostics_measured_at ?? null;
  const hasSpeedMeasurement = internetSpeedMeasuredAt !== null || internetDownloadMbps !== null ||
    internetUploadMbps !== null || internetLatencyMs !== null || internetResponsivenessRpm !== null;

  if (
    !(sampleId === null || (typeof sampleId === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sampleId))) ||
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
    !(batteryCondition === null || (typeof batteryCondition === "string" && batteryConditions.has(batteryCondition))) ||
    !nullableNumber(batteryCycleCount, 100_000) ||
    !nullableNumber(batteryDesignCapacityMah, 100_000) ||
    !nullableNumber(batteryFullChargeCapacityMah, 100_000) ||
    !nullableNumber(batteryHealthPercent, 200) ||
    !(thermalState === null || (typeof thermalState === "string" && thermalStates.has(thermalState))) ||
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
    typeof networkDiagnosticsEnabled !== "boolean" ||
    !nullableBoolean(networkRouteAvailable) ||
    !nullableBoolean(networkGatewayReachable) ||
    !nullableBoolean(networkDnsAvailable) ||
    !nullableBoolean(networkHttpsAvailable) ||
    !nullableBoolean(networkIngestReachable) ||
    !nullableNumber(networkGatewayLatencyMs, 60_000) ||
    !nullableNumber(networkGatewayJitterMs, 60_000) ||
    !nullableNumber(networkGatewayPacketLossPercent, 100) ||
    !(networkFault === null || (typeof networkFault === "string" && networkFaults.has(networkFault))) ||
    !(networkDiagnosticsMeasuredAt === null || (typeof networkDiagnosticsMeasuredAt === "string" &&
      !Number.isNaN(Date.parse(networkDiagnosticsMeasuredAt)))) ||
    !(item.chrome_checked === 0 || item.chrome_checked === 1) ||
    !nullableBoolean(item.chrome_running)
  ) return null;

  return {
    ...item,
    sample_id: sampleId,
    timestamp: new Date(timestamp).toISOString(),
    internet_speed_enabled: internetSpeedEnabled,
    internet_download_mbps: internetDownloadMbps,
    internet_upload_mbps: internetUploadMbps,
    internet_latency_ms: internetLatencyMs,
    internet_responsiveness_rpm: internetResponsivenessRpm,
    internet_speed_measured_at: internetSpeedMeasuredAt,
    battery_condition: batteryCondition,
    battery_cycle_count: batteryCycleCount,
    battery_design_capacity_mah: batteryDesignCapacityMah,
    battery_full_charge_capacity_mah: batteryFullChargeCapacityMah,
    battery_health_percent: batteryHealthPercent,
    thermal_state: thermalState,
    network_diagnostics_enabled: networkDiagnosticsEnabled,
    network_route_available: networkRouteAvailable,
    network_gateway_reachable: networkGatewayReachable,
    network_dns_available: networkDnsAvailable,
    network_https_available: networkHttpsAvailable,
    network_ingest_reachable: networkIngestReachable,
    network_gateway_latency_ms: networkGatewayLatencyMs,
    network_gateway_jitter_ms: networkGatewayJitterMs,
    network_gateway_packet_loss_percent: networkGatewayPacketLossPercent,
    network_fault: networkFault,
    network_diagnostics_measured_at: networkDiagnosticsMeasuredAt,
  } as IncomingHealth;
}
