import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const healthSamples = sqliteTable(
  "health_samples",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sampleId: text("sample_id").unique(),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reportedAt: text("reported_at").notNull(),
    version: text("version").notNull(),
    health: text("health").notNull(),
    mode: text("mode").notNull(),
    installed: integer("installed", { mode: "boolean" }).notNull(),
    serviceState: text("service_state").notNull(),
    pid: integer("pid"),
    idleSleepPrevented: integer("idle_sleep_prevented", { mode: "boolean" }).notNull(),
    powerSource: text("power_source").notNull(),
    batteryPercent: integer("battery_percent"),
    batteryCondition: text("battery_condition"),
    batteryCycleCount: integer("battery_cycle_count"),
    batteryDesignCapacityMah: integer("battery_design_capacity_mah"),
    batteryFullChargeCapacityMah: integer("battery_full_charge_capacity_mah"),
    batteryHealthPercent: real("battery_health_percent"),
    thermalState: text("thermal_state"),
    charging: integer("charging", { mode: "boolean" }),
    lidClosed: integer("lid_closed", { mode: "boolean" }),
    networkChecked: integer("network_checked", { mode: "boolean" }).notNull(),
    networkAvailable: integer("network_available", { mode: "boolean" }),
    internetSpeedEnabled: integer("internet_speed_enabled", { mode: "boolean" }).notNull().default(false),
    internetDownloadMbps: real("internet_download_mbps"),
    internetUploadMbps: real("internet_upload_mbps"),
    internetLatencyMs: real("internet_latency_ms"),
    internetResponsivenessRpm: real("internet_responsiveness_rpm"),
    internetSpeedMeasuredAt: text("internet_speed_measured_at"),
    networkDiagnosticsEnabled: integer("network_diagnostics_enabled", { mode: "boolean" }).notNull().default(false),
    networkRouteAvailable: integer("network_route_available", { mode: "boolean" }),
    networkGatewayReachable: integer("network_gateway_reachable", { mode: "boolean" }),
    networkDnsAvailable: integer("network_dns_available", { mode: "boolean" }),
    networkHttpsAvailable: integer("network_https_available", { mode: "boolean" }),
    networkIngestReachable: integer("network_ingest_reachable", { mode: "boolean" }),
    networkGatewayLatencyMs: real("network_gateway_latency_ms"),
    networkGatewayJitterMs: real("network_gateway_jitter_ms"),
    networkGatewayPacketLossPercent: real("network_gateway_packet_loss_percent"),
    networkFault: text("network_fault"),
    networkDiagnosticsMeasuredAt: text("network_diagnostics_measured_at"),
    chromeChecked: integer("chrome_checked", { mode: "boolean" }).notNull(),
    chromeRunning: integer("chrome_running", { mode: "boolean" }),
  },
  (table) => [
    index("health_samples_received_at_idx").on(table.receivedAt),
    index("health_samples_reported_at_idx").on(table.reportedAt),
  ],
);

export const alertSettings = sqliteTable("alert_settings", {
  id: integer("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  offlineAfterSeconds: integer("offline_after_seconds").notNull().default(180),
  batteryThreshold: integer("battery_threshold").notNull().default(25),
  alertKeepawake: integer("alert_keepawake", { mode: "boolean" }).notNull().default(true),
  alertPower: integer("alert_power", { mode: "boolean" }).notNull().default(true),
  alertNetwork: integer("alert_network", { mode: "boolean" }).notNull().default(true),
  alertChrome: integer("alert_chrome", { mode: "boolean" }).notNull().default(true),
  alertBatteryHealth: integer("alert_battery_health", { mode: "boolean" }).notNull().default(true),
  alertThermal: integer("alert_thermal", { mode: "boolean" }).notNull().default(true),
  batteryHealthThreshold: integer("battery_health_threshold").notNull().default(80),
  batteryDegradationThreshold: integer("battery_degradation_threshold").notNull().default(5),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const alertEvents = sqliteTable(
  "alert_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    kind: text("kind").notNull(),
    state: text("state").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    delivered: integer("delivered", { mode: "boolean" }).notNull().default(false),
    deliveryError: text("delivery_error"),
    deliveryAttempts: integer("delivery_attempts").notNull().default(0),
    lastAttemptAt: text("last_attempt_at"),
    nextAttemptAt: text("next_attempt_at"),
    deliveryTarget: text("delivery_target"),
    deliveredAt: text("delivered_at"),
  },
  (table) => [
    index("alert_events_kind_id_idx").on(table.kind, table.id),
    index("alert_events_retry_idx").on(table.delivered, table.nextAttemptAt, table.id),
  ],
);

export const schedulerRuntime = sqliteTable("scheduler_runtime", {
  id: integer("id").primaryKey(),
  lastRunAt: text("last_run_at"),
  lastSuccessAt: text("last_success_at"),
  lastError: text("last_error"),
  leaseUntil: text("lease_until"),
  lastCanaryAt: text("last_canary_at"),
});

export const authFailures = sqliteTable("auth_failures", {
  bucket: text("bucket").primaryKey(),
  windowStartedAt: text("window_started_at").notNull(),
  failures: integer("failures").notNull().default(0),
});
