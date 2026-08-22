import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrations = [
  "0000_lumpy_susan_delgado.sql",
  "0001_late_stranger.sql",
  "0002_ambitious_lightspeed.sql",
  "0003_lush_grim_reaper.sql",
  "0004_v14_resilient_observability.sql",
];

test("D1 migrations are additive and preserve an existing heartbeat", async () => {
  const db = new DatabaseSync(":memory:");
  const initial = await readFile(new URL(`../drizzle/${migrations[0]}`, import.meta.url), "utf8");
  db.exec(initial);
  db.prepare(`
    INSERT INTO health_samples (
      reported_at, version, health, mode, installed, service_state, pid,
      idle_sleep_prevented, power_source, battery_percent, charging,
      lid_closed, network_checked, network_available, chrome_checked,
      chrome_running
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "2026-08-21T00:00:00Z", "1.2.0", "healthy", "user", 1,
    "running", 42, 1, "AC Power", 80, 1, 0, 1, 1, 1, 1,
  );

  for (const migration of migrations.slice(1)) {
    const sql = await readFile(new URL(`../drizzle/${migration}`, import.meta.url), "utf8");
    assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM/i);
    db.exec(sql);
  }

  assert.equal(db.prepare("SELECT count(*) AS count FROM health_samples").get().count, 1);
  const columns = db.prepare("PRAGMA table_info(health_samples)").all().map(({ name }) => name);
  assert.ok(columns.includes("internet_speed_measured_at"));
  assert.ok(columns.includes("internet_download_mbps"));
  assert.ok(columns.includes("sample_id"));
  assert.ok(columns.includes("battery_health_percent"));
  assert.ok(columns.includes("thermal_state"));
  assert.ok(columns.includes("network_gateway_jitter_ms"));
  assert.ok(columns.includes("network_diagnostics_measured_at"));
  const indexes = db.prepare("PRAGMA index_list(health_samples)").all();
  assert.ok(indexes.some(({ name, unique }) => name === "health_samples_sample_id_unique" && unique === 1));
  assert.ok(indexes.some(({ name }) => name === "health_samples_reported_at_idx"));
  assert.ok(db.prepare("PRAGMA table_info(scheduler_runtime)").all().some(({ name }) => name === "last_success_at"));
  assert.ok(db.prepare("PRAGMA table_info(auth_failures)").all().some(({ name }) => name === "failures"));
  assert.ok(db.prepare("PRAGMA table_info(alert_events)").all().some(({ name }) => name === "delivery_attempts"));
  assert.ok(db.prepare("PRAGMA table_info(alert_settings)").all().some(({ name }) => name === "battery_degradation_threshold"));
  assert.equal(db.prepare("SELECT version FROM health_samples WHERE pid = 42").get().version, "1.2.0");
});
