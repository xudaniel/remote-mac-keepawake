import { getD1 } from "../db";
import type { IncomingHealth } from "./health";

export type AlertKind = "offline" | "battery" | "power" | "keepawake" | "network" | "chrome" | "battery_health" | "thermal";
export type AlertState = "active" | "recovered" | "test";

export type AlertSettings = {
  enabled: boolean;
  offline_after_seconds: number;
  battery_threshold: number;
  alert_keepawake: boolean;
  alert_power: boolean;
  alert_network: boolean;
  alert_chrome: boolean;
  alert_battery_health: boolean;
  alert_thermal: boolean;
  battery_health_threshold: number;
  battery_degradation_threshold: number;
  updated_at: string;
};

type RawAlertSettings = {
  enabled: number;
  offline_after_seconds: number;
  battery_threshold: number;
  alert_keepawake: number;
  alert_power: number;
  alert_network: number;
  alert_chrome: number;
  alert_battery_health: number;
  alert_thermal: number;
  battery_health_threshold: number;
  battery_degradation_threshold: number;
  updated_at: string;
};

type AlertCondition = {
  kind: AlertKind;
  active: boolean;
  severity: "warning" | "critical";
  activeMessage: string;
  recoveryMessage: string;
};

type PendingEvent = {
  id: number;
  created_at: string;
  kind: AlertKind;
  state: AlertState;
  severity: string;
  delivery_attempts: number;
};

const RETRY_DELAYS_SECONDS = [60, 300, 1_800, 7_200, 21_600];

function configuredWebhook(name: "primary" | "fallback") {
  const value = (name === "primary" ? process.env.ALERT_WEBHOOK_URL : process.env.ALERT_FALLBACK_WEBHOOK_URL)?.trim();
  return value || null;
}

export function webhookConfigured() {
  return configuredWebhook("primary") !== null;
}

export function fallbackWebhookConfigured() {
  return configuredWebhook("fallback") !== null;
}

function normalizeSettings(row: RawAlertSettings): AlertSettings {
  return {
    enabled: Boolean(row.enabled),
    offline_after_seconds: row.offline_after_seconds,
    battery_threshold: row.battery_threshold,
    alert_keepawake: Boolean(row.alert_keepawake),
    alert_power: Boolean(row.alert_power),
    alert_network: Boolean(row.alert_network),
    alert_chrome: Boolean(row.alert_chrome),
    alert_battery_health: Boolean(row.alert_battery_health),
    alert_thermal: Boolean(row.alert_thermal),
    battery_health_threshold: row.battery_health_threshold,
    battery_degradation_threshold: row.battery_degradation_threshold,
    updated_at: row.updated_at,
  };
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const d1 = getD1();
  await d1.prepare(`
    INSERT OR IGNORE INTO alert_settings
      (id, enabled, offline_after_seconds, battery_threshold, alert_keepawake, alert_power,
       alert_network, alert_chrome, alert_battery_health, alert_thermal,
       battery_health_threshold, battery_degradation_threshold)
    VALUES (1, 0, 180, 25, 1, 1, 1, 1, 1, 1, 80, 5)
  `).run();
  const row = await d1.prepare(`
    SELECT enabled, offline_after_seconds, battery_threshold, alert_keepawake,
           alert_power, alert_network, alert_chrome, alert_battery_health,
           alert_thermal, battery_health_threshold, battery_degradation_threshold, updated_at
    FROM alert_settings WHERE id = 1
  `).first<RawAlertSettings>();
  if (!row) throw new Error("Alert settings are unavailable");
  return normalizeSettings(row);
}

export async function saveAlertSettings(input: Omit<AlertSettings, "updated_at">) {
  const d1 = getD1();
  await d1.prepare(`
    INSERT INTO alert_settings
      (id, enabled, offline_after_seconds, battery_threshold, alert_keepawake, alert_power,
       alert_network, alert_chrome, alert_battery_health, alert_thermal,
       battery_health_threshold, battery_degradation_threshold, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      offline_after_seconds = excluded.offline_after_seconds,
      battery_threshold = excluded.battery_threshold,
      alert_keepawake = excluded.alert_keepawake,
      alert_power = excluded.alert_power,
      alert_network = excluded.alert_network,
      alert_chrome = excluded.alert_chrome,
      alert_battery_health = excluded.alert_battery_health,
      alert_thermal = excluded.alert_thermal,
      battery_health_threshold = excluded.battery_health_threshold,
      battery_degradation_threshold = excluded.battery_degradation_threshold,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    Number(input.enabled), input.offline_after_seconds, input.battery_threshold,
    Number(input.alert_keepawake), Number(input.alert_power), Number(input.alert_network),
    Number(input.alert_chrome), Number(input.alert_battery_health), Number(input.alert_thermal),
    input.battery_health_threshold, input.battery_degradation_threshold,
  ).run();
  return getAlertSettings();
}

async function postWebhook(url: string, kind: AlertKind | "test", state: AlertState, severity: string, occurredAt: string) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product: "Mac Pulse", kind, state, severity, occurred_at: occurredAt }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return `Webhook returned HTTP ${response.status}`;
    return null;
  } catch (error) {
    return (error instanceof Error ? error.message : "Webhook request failed").slice(0, 180);
  }
}

async function deliver(kind: AlertKind | "test", state: AlertState, severity: string, occurredAt: string) {
  const primary = configuredWebhook("primary");
  if (!primary) return { delivered: false, error: "Webhook is not configured", target: null };
  const primaryError = await postWebhook(primary, kind, state, severity, occurredAt);
  if (!primaryError) return { delivered: true, error: null, target: "primary" };
  const fallback = configuredWebhook("fallback");
  if (!fallback) return { delivered: false, error: primaryError, target: "primary" };
  const fallbackError = await postWebhook(fallback, kind, state, severity, occurredAt);
  return fallbackError
    ? { delivered: false, error: `Primary: ${primaryError}; fallback: ${fallbackError}`.slice(0, 180), target: "fallback" }
    : { delivered: true, error: null, target: "fallback" };
}

async function attemptEventDelivery(event: PendingEvent) {
  const attemptedAt = new Date().toISOString();
  const delivery = await deliver(event.kind, event.state, event.severity, event.created_at);
  const attempts = Number(event.delivery_attempts) + 1;
  const delay = RETRY_DELAYS_SECONDS[Math.min(attempts - 1, RETRY_DELAYS_SECONDS.length - 1)];
  const nextAttemptAt = delivery.delivered || attempts >= RETRY_DELAYS_SECONDS.length
    ? null
    : new Date(Date.now() + delay * 1_000).toISOString();
  await getD1().prepare(`
    UPDATE alert_events SET delivered = ?, delivery_error = ?, delivery_attempts = ?,
      last_attempt_at = ?, next_attempt_at = ?, delivery_target = ?, delivered_at = ?
    WHERE id = ?
  `).bind(
    Number(delivery.delivered), delivery.error, attempts, attemptedAt, nextAttemptAt,
    delivery.target, delivery.delivered ? attemptedAt : null, event.id,
  ).run();
  return delivery;
}

async function recordEvent(kind: AlertKind, state: AlertState, severity: string, message: string) {
  const createdAt = new Date().toISOString();
  const result = await getD1().prepare(`
    INSERT INTO alert_events
      (created_at, kind, state, severity, message, delivered, delivery_attempts, next_attempt_at)
    VALUES (?, ?, ?, ?, ?, 0, 0, ?)
  `).bind(createdAt, kind, state, severity, message, createdAt).run();
  await attemptEventDelivery({
    id: Number(result.meta.last_row_id), created_at: createdAt, kind, state, severity, delivery_attempts: 0,
  });
}

export async function retryPendingAlerts(limit = 10) {
  const events = await getD1().prepare(`
    SELECT id, created_at, kind, state, severity, delivery_attempts
    FROM alert_events
    WHERE delivered = 0 AND delivery_attempts < ?
      AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
    ORDER BY id ASC LIMIT ?
  `).bind(RETRY_DELAYS_SECONDS.length, new Date().toISOString(), limit).all<PendingEvent>();
  let delivered = 0;
  for (const event of events.results ?? []) {
    if ((await attemptEventDelivery(event)).delivered) delivered += 1;
  }
  return { attempted: events.results?.length ?? 0, delivered };
}

async function latestState(kind: AlertKind) {
  const row = await getD1().prepare(`SELECT state FROM alert_events WHERE kind = ? ORDER BY id DESC LIMIT 1`)
    .bind(kind).first<{ state: AlertState }>();
  return row?.state ?? null;
}

async function applyCondition(condition: AlertCondition) {
  const prior = await latestState(condition.kind);
  if (condition.active && prior !== "active") {
    await recordEvent(condition.kind, "active", condition.severity, condition.activeMessage);
  } else if (!condition.active && prior === "active") {
    await recordEvent(condition.kind, "recovered", "warning", condition.recoveryMessage);
  }
}

export async function processHeartbeatAlerts(item: IncomingHealth) {
  const settings = await getAlertSettings();
  if (!settings.enabled) return;
  const priorHardware = await getD1().prepare(`
    SELECT battery_health_percent, thermal_state
    FROM health_samples ORDER BY id DESC LIMIT 1 OFFSET 1
  `).first<{ battery_health_percent: number | null; thermal_state: string | null }>();
  const rapidBatteryDrop = item.battery_health_percent !== null &&
    priorHardware?.battery_health_percent !== null && priorHardware?.battery_health_percent !== undefined &&
    priorHardware.battery_health_percent - item.battery_health_percent >= settings.battery_degradation_threshold;
  const abnormalThermal = item.thermal_state === "serious" || item.thermal_state === "critical";
  const sustainedThermal = item.thermal_state === "critical" ||
    (abnormalThermal && (priorHardware?.thermal_state === "serious" || priorHardware?.thermal_state === "critical"));
  const powerOnBattery = /battery/i.test(item.power_source) && item.charging !== true &&
    (item.battery_percent === null || item.battery_percent < 100);
  const conditions: AlertCondition[] = [
    { kind: "offline", active: false, severity: "critical", activeMessage: "The Mac stopped checking in.", recoveryMessage: "Heartbeat reporting resumed." },
    { kind: "battery", active: item.battery_percent !== null && item.battery_percent <= settings.battery_threshold && item.charging !== true, severity: "critical", activeMessage: `Battery reached ${item.battery_percent ?? "unknown"}% while not charging.`, recoveryMessage: "Battery is above the alert threshold or charging again." },
    { kind: "power", active: settings.alert_power && powerOnBattery, severity: "warning", activeMessage: "The Mac changed to battery power.", recoveryMessage: "External power is available again." },
    { kind: "keepawake", active: settings.alert_keepawake && (!item.idle_sleep_prevented || item.service_state !== "running"), severity: "critical", activeMessage: "KeepAwake protection is not verified.", recoveryMessage: "KeepAwake protection is verified again." },
    { kind: "network", active: settings.alert_network && ((item.network_diagnostics_enabled && item.network_fault !== "none" && item.network_fault !== "unknown") || (item.network_checked === 1 && item.network_available === false)), severity: "critical", activeMessage: `The network path reports ${item.network_fault ?? "a failure"}.`, recoveryMessage: "The monitored network path recovered." },
    { kind: "chrome", active: settings.alert_chrome && item.chrome_checked === 1 && item.chrome_running === false, severity: "warning", activeMessage: "Chrome Remote Desktop is not running.", recoveryMessage: "Chrome Remote Desktop is running again." },
    { kind: "battery_health", active: settings.alert_battery_health && (item.battery_condition === "service-recommended" || (item.battery_health_percent !== null && item.battery_health_percent < settings.battery_health_threshold) || rapidBatteryDrop), severity: "warning", activeMessage: "Battery health crossed its configured service or rapid-degradation threshold.", recoveryMessage: "The battery-health warning cleared." },
    { kind: "thermal", active: settings.alert_thermal && sustainedThermal, severity: item.thermal_state === "critical" ? "critical" : "warning", activeMessage: `The Mac reports sustained ${item.thermal_state} thermal pressure.`, recoveryMessage: "Thermal pressure returned to a normal range." },
  ];
  for (const condition of conditions) await applyCondition(condition);
}

export async function processOfflineAlert() {
  const settings = await getAlertSettings();
  if (!settings.enabled) return { checked: false, reason: "alerts-disabled" };
  const latest = await getD1().prepare(`SELECT received_at FROM health_samples ORDER BY id DESC LIMIT 1`).first<{ received_at: string }>();
  const received = latest ? Date.parse(`${latest.received_at.replace(" ", "T")}Z`) : 0;
  const ageSeconds = latest ? Math.max(0, Math.floor((Date.now() - received) / 1_000)) : Number.POSITIVE_INFINITY;
  await applyCondition({ kind: "offline", active: ageSeconds > settings.offline_after_seconds, severity: "critical", activeMessage: "The Mac stopped checking in.", recoveryMessage: "Heartbeat reporting resumed." });
  return { checked: true, offline: ageSeconds > settings.offline_after_seconds, age_seconds: Number.isFinite(ageSeconds) ? ageSeconds : null };
}

async function sendSchedulerCanary(occurredAt: string) {
  const url = process.env.SCHEDULER_CANARY_URL?.trim();
  if (!url) return false;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product: "Mac Pulse", state: "scheduler-ok", occurred_at: occurredAt }),
    signal: AbortSignal.timeout(6_000),
  });
  return response.ok;
}

export async function runScheduledMonitoring() {
  const d1 = getD1();
  const now = new Date().toISOString();
  const leaseUntil = new Date(Date.now() + 55_000).toISOString();
  await d1.prepare(`INSERT OR IGNORE INTO scheduler_runtime (id, lease_until) VALUES (1, NULL)`).run();
  const lease = await d1.prepare(`
    UPDATE scheduler_runtime SET lease_until = ?
    WHERE id = 1 AND (lease_until IS NULL OR lease_until < ?)
  `).bind(leaseUntil, now).run();
  if (Number(lease.meta.changes ?? 0) !== 1) return { skipped: true, reason: "lease-held" };
  await d1.prepare("UPDATE scheduler_runtime SET last_run_at = ?, last_error = NULL WHERE id = 1").bind(now).run();
  try {
    const offline = await processOfflineAlert();
    const retries = await retryPendingAlerts();
    const canary = await sendSchedulerCanary(now);
    await d1.prepare(`
      UPDATE scheduler_runtime SET last_success_at = ?, last_error = NULL,
        lease_until = NULL, last_canary_at = CASE WHEN ? THEN ? ELSE last_canary_at END
      WHERE id = 1
    `).bind(now, Number(canary), now).run();
    return { skipped: false, offline, retries, canary };
  } catch (error) {
    const message = (error instanceof Error ? error.message : "Scheduled monitoring failed").slice(0, 180);
    await d1.prepare("UPDATE scheduler_runtime SET last_error = ?, lease_until = NULL WHERE id = 1")
      .bind(message).run();
    throw error;
  }
}

export async function getSchedulerRuntime() {
  await getD1().prepare("INSERT OR IGNORE INTO scheduler_runtime (id, lease_until) VALUES (1, NULL)").run();
  return getD1().prepare(`
    SELECT last_run_at, last_success_at, last_error, last_canary_at
    FROM scheduler_runtime WHERE id = 1
  `).first();
}

export async function sendTestAlert() {
  const createdAt = new Date().toISOString();
  return deliver("test", "test", "warning", createdAt);
}
