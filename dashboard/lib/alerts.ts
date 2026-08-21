import { getD1 } from "../db";
import type { IncomingHealth } from "./health";

export type AlertKind = "offline" | "battery" | "power" | "keepawake" | "network" | "chrome";
export type AlertState = "active" | "recovered" | "test";

export type AlertSettings = {
  enabled: boolean;
  offline_after_seconds: number;
  battery_threshold: number;
  alert_keepawake: boolean;
  alert_power: boolean;
  alert_network: boolean;
  alert_chrome: boolean;
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
  updated_at: string;
};

type AlertCondition = {
  kind: AlertKind;
  active: boolean;
  severity: "warning" | "critical";
  activeMessage: string;
  recoveryMessage: string;
};

function configuredWebhook() {
  const value = process.env.ALERT_WEBHOOK_URL?.trim();
  return value || null;
}

export function webhookConfigured() {
  return configuredWebhook() !== null;
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
    updated_at: row.updated_at,
  };
}

export async function getAlertSettings(): Promise<AlertSettings> {
  const d1 = getD1();
  await d1.prepare(`
    INSERT OR IGNORE INTO alert_settings
      (id, enabled, offline_after_seconds, battery_threshold, alert_keepawake, alert_power, alert_network, alert_chrome)
    VALUES (1, 0, 180, 25, 1, 1, 1, 1)
  `).run();
  const row = await d1.prepare(`
    SELECT enabled, offline_after_seconds, battery_threshold, alert_keepawake,
           alert_power, alert_network, alert_chrome, updated_at
    FROM alert_settings WHERE id = 1
  `).first<RawAlertSettings>();
  if (!row) throw new Error("Alert settings are unavailable");
  return normalizeSettings(row);
}

export async function saveAlertSettings(input: Omit<AlertSettings, "updated_at">) {
  const d1 = getD1();
  await d1.prepare(`
    INSERT INTO alert_settings
      (id, enabled, offline_after_seconds, battery_threshold, alert_keepawake, alert_power, alert_network, alert_chrome, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      offline_after_seconds = excluded.offline_after_seconds,
      battery_threshold = excluded.battery_threshold,
      alert_keepawake = excluded.alert_keepawake,
      alert_power = excluded.alert_power,
      alert_network = excluded.alert_network,
      alert_chrome = excluded.alert_chrome,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    Number(input.enabled),
    input.offline_after_seconds,
    input.battery_threshold,
    Number(input.alert_keepawake),
    Number(input.alert_power),
    Number(input.alert_network),
    Number(input.alert_chrome),
  ).run();
  return getAlertSettings();
}

async function deliver(kind: AlertKind | "test", state: AlertState, severity: string, occurredAt: string) {
  const webhook = configuredWebhook();
  if (!webhook) return { delivered: false, error: "Webhook is not configured" };
  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product: "Mac Pulse",
        kind,
        state,
        severity,
        occurred_at: occurredAt,
      }),
      signal: AbortSignal.timeout(6_000),
    });
    if (!response.ok) return { delivered: false, error: `Webhook returned HTTP ${response.status}` };
    return { delivered: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook request failed";
    return { delivered: false, error: message.slice(0, 180) };
  }
}

async function recordEvent(kind: AlertKind, state: AlertState, severity: string, message: string) {
  const d1 = getD1();
  const createdAt = new Date().toISOString();
  const result = await d1.prepare(`
    INSERT INTO alert_events (created_at, kind, state, severity, message, delivered)
    VALUES (?, ?, ?, ?, ?, 0)
  `).bind(createdAt, kind, state, severity, message).run();
  const id = Number(result.meta.last_row_id);
  const delivery = await deliver(kind, state, severity, createdAt);
  await d1.prepare(`
    UPDATE alert_events SET delivered = ?, delivery_error = ? WHERE id = ?
  `).bind(Number(delivery.delivered), delivery.error, id).run();
}

async function latestState(kind: AlertKind) {
  const row = await getD1().prepare(`
    SELECT state FROM alert_events WHERE kind = ? ORDER BY id DESC LIMIT 1
  `).bind(kind).first<{ state: AlertState }>();
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
  const powerOnBattery = /battery/i.test(item.power_source) && item.charging !== true && (item.battery_percent === null || item.battery_percent < 100);
  const conditions: AlertCondition[] = [
    {
      kind: "offline",
      active: false,
      severity: "critical",
      activeMessage: "The Mac stopped checking in.",
      recoveryMessage: "Heartbeat reporting resumed.",
    },
    {
      kind: "battery",
      active: item.battery_percent !== null && item.battery_percent <= settings.battery_threshold && item.charging !== true,
      severity: "critical",
      activeMessage: `Battery reached ${item.battery_percent ?? "unknown"}% while not charging.`,
      recoveryMessage: "Battery is above the alert threshold or charging again.",
    },
    {
      kind: "power",
      active: settings.alert_power && powerOnBattery,
      severity: "warning",
      activeMessage: "The Mac changed to battery power.",
      recoveryMessage: "External power is available again.",
    },
    {
      kind: "keepawake",
      active: settings.alert_keepawake && (!item.idle_sleep_prevented || item.service_state !== "running"),
      severity: "critical",
      activeMessage: "KeepAwake protection is not verified.",
      recoveryMessage: "KeepAwake protection is verified again.",
    },
    {
      kind: "network",
      active: settings.alert_network && item.network_checked === 1 && item.network_available === false,
      severity: "critical",
      activeMessage: "The configured network check failed.",
      recoveryMessage: "The configured network check recovered.",
    },
    {
      kind: "chrome",
      active: settings.alert_chrome && item.chrome_checked === 1 && item.chrome_running === false,
      severity: "warning",
      activeMessage: "Chrome Remote Desktop is not running.",
      recoveryMessage: "Chrome Remote Desktop is running again.",
    },
  ];
  for (const condition of conditions) await applyCondition(condition);
}

export async function processOfflineAlert() {
  const settings = await getAlertSettings();
  if (!settings.enabled) return { checked: false, reason: "alerts-disabled" };
  const latest = await getD1().prepare(`
    SELECT received_at FROM health_samples ORDER BY id DESC LIMIT 1
  `).first<{ received_at: string }>();
  const received = latest ? Date.parse(`${latest.received_at.replace(" ", "T")}Z`) : 0;
  const ageSeconds = latest ? Math.max(0, Math.floor((Date.now() - received) / 1_000)) : Number.POSITIVE_INFINITY;
  await applyCondition({
    kind: "offline",
    active: ageSeconds > settings.offline_after_seconds,
    severity: "critical",
    activeMessage: "The Mac stopped checking in.",
    recoveryMessage: "Heartbeat reporting resumed.",
  });
  return { checked: true, offline: ageSeconds > settings.offline_after_seconds, age_seconds: Number.isFinite(ageSeconds) ? ageSeconds : null };
}

export async function sendTestAlert() {
  const createdAt = new Date().toISOString();
  return deliver("test", "test", "warning", createdAt);
}
