import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const migrations = [
  "0000_lumpy_susan_delgado.sql",
  "0001_late_stranger.sql",
  "0002_ambitious_lightspeed.sql",
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
  assert.equal(db.prepare("SELECT version FROM health_samples WHERE pid = 42").get().version, "1.2.0");
});
