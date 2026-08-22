import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import test from "node:test";
import {
  canonicalHeartbeatInput,
  constantTimeEqual,
  hmacHex,
  SIGNATURE_WINDOW_SECONDS,
  transportTimestampIsFresh,
} from "../lib/heartbeat-signature.ts";

const secret = "unit-test-signing-secret";
const timestamp = "2026-08-22T04:20:00Z";
const sampleId = "123e4567-e89b-12d3-a456-426614174000";
const body = JSON.stringify({ timestamp: "2026-08-21T00:00:00Z", sample_id: sampleId });

test("canonical heartbeat signature binds the exact request", async () => {
  const canonical = await canonicalHeartbeatInput("POST", "/api/heartbeat", timestamp, sampleId, body);
  const digest = createHash("sha256").update(body).digest("hex");
  assert.equal(canonical, `POST\n/api/heartbeat\n${timestamp}\n${sampleId}\n${digest}`);
  const expected = createHmac("sha256", secret).update(canonical).digest("hex");
  assert.equal(await hmacHex(secret, canonical), expected);
  assert.ok(constantTimeEqual(await hmacHex(secret, canonical), expected));
});

test("body, header, and path tampering change the signature", async () => {
  const original = await hmacHex(secret, await canonicalHeartbeatInput("POST", "/api/heartbeat", timestamp, sampleId, body));
  const changed = await Promise.all([
    canonicalHeartbeatInput("POST", "/api/heartbeat", timestamp, sampleId, `${body} `),
    canonicalHeartbeatInput("POST", "/api/heartbeat", "2026-08-22T04:20:01Z", sampleId, body),
    canonicalHeartbeatInput("POST", "/api/heartbeat", timestamp, "223e4567-e89b-12d3-a456-426614174000", body),
    canonicalHeartbeatInput("POST", "/api/other", timestamp, sampleId, body),
  ]);
  for (const canonical of changed) assert.notEqual(await hmacHex(secret, canonical), original);
  assert.equal(constantTimeEqual(original, `${original.slice(0, -1)}0`), false);
});

test("transport freshness is independent from observation time", () => {
  const now = Date.parse(timestamp);
  assert.equal(transportTimestampIsFresh(timestamp, now), true);
  assert.equal(transportTimestampIsFresh(new Date(now - SIGNATURE_WINDOW_SECONDS * 1_000).toISOString(), now), true);
  assert.equal(transportTimestampIsFresh(new Date(now - (SIGNATURE_WINDOW_SECONDS + 1) * 1_000).toISOString(), now), false);
  assert.equal(transportTimestampIsFresh("not-a-time", now), false);
  assert.match(body, /2026-08-21/);
});
