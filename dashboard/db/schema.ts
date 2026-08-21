import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const healthSamples = sqliteTable(
  "health_samples",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
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
    chromeChecked: integer("chrome_checked", { mode: "boolean" }).notNull(),
    chromeRunning: integer("chrome_running", { mode: "boolean" }),
  },
  (table) => [index("health_samples_received_at_idx").on(table.receivedAt)],
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
  },
  (table) => [index("alert_events_kind_id_idx").on(table.kind, table.id)],
);
