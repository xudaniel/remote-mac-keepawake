import { getD1 } from "../db";
import {
  canonicalHeartbeatInput,
  constantTimeEqual,
  hmacHex,
  transportTimestampIsFresh,
} from "./heartbeat-signature";

const LOCAL_SECRETS = {
  VIEW_TOKEN: "local-view-token",
  INGEST_TOKEN: "local-ingest-token",
} as const;

export type SecretName = keyof typeof LOCAL_SECRETS;

function getSecret(name: SecretName): string | null {
  const configured = process.env[name]?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : LOCAL_SECRETS[name];
}

const AUTH_FAILURE_WINDOW_SECONDS = 60;
const AUTH_FAILURE_LIMIT = 30;

function heartbeatSecret(keyId: string): string | null {
  const configuredKeys = process.env.INGEST_KEYS_JSON?.trim();
  if (configuredKeys) {
    try {
      const parsed = JSON.parse(configuredKeys) as Record<string, unknown>;
      const selected = parsed[keyId];
      if (typeof selected === "string" && selected.trim()) return selected.trim();
    } catch {
      return null;
    }
  }
  if (keyId === "current") return getSecret("INGEST_TOKEN");
  if (keyId === "next") return process.env.INGEST_TOKEN_NEXT?.trim() || null;
  if (keyId === "previous") return process.env.INGEST_TOKEN_PREVIOUS?.trim() || null;
  return null;
}

async function authFailureBucket(request: Request, keyId: string) {
  const source = request.headers.get("cf-connecting-ip")?.trim() || `unavailable:${keyId}`;
  const salt = process.env.AUTH_RATE_LIMIT_SALT?.trim() || getSecret("INGEST_TOKEN") || "local-auth-rate-limit";
  return `source:${(await hmacHex(salt, source)).slice(0, 32)}`;
}

async function authFailureLimited(bucket: string) {
  const row = await getD1().prepare(`
    SELECT window_started_at, failures FROM auth_failures WHERE bucket = ?
  `).bind(bucket).first<{ window_started_at: string; failures: number }>();
  if (!row) return false;
  const ageSeconds = Math.max(0, (Date.now() - Date.parse(row.window_started_at)) / 1_000);
  return ageSeconds < AUTH_FAILURE_WINDOW_SECONDS && Number(row.failures) >= AUTH_FAILURE_LIMIT;
}

async function recordAuthFailure(bucket: string) {
  const now = new Date().toISOString();
  await getD1().prepare("DELETE FROM auth_failures WHERE julianday(window_started_at) < julianday('now', '-1 day')").run();
  await getD1().prepare(`
    INSERT INTO auth_failures (bucket, window_started_at, failures)
    VALUES (?, ?, 1)
    ON CONFLICT(bucket) DO UPDATE SET
      window_started_at = CASE
        WHEN strftime('%s', ?) - strftime('%s', auth_failures.window_started_at) >= ? THEN ?
        ELSE auth_failures.window_started_at
      END,
      failures = CASE
        WHEN strftime('%s', ?) - strftime('%s', auth_failures.window_started_at) >= ? THEN 1
        ELSE auth_failures.failures + 1
      END
  `).bind(
    bucket, now, now, AUTH_FAILURE_WINDOW_SECONDS, now,
    now, AUTH_FAILURE_WINDOW_SECONDS,
  ).run();
}

export type HeartbeatAuthorization = {
  authorized: boolean;
  key_id: string | null;
  legacy: boolean;
};

export async function authorizeHeartbeat(request: Request, body: string): Promise<HeartbeatAuthorization> {
  const keyId = request.headers.get("x-mac-pulse-key-id")?.trim() ?? "";
  const transportTimestamp = request.headers.get("x-mac-pulse-timestamp")?.trim() ?? "";
  const sampleId = request.headers.get("x-mac-pulse-sample-id")?.trim() ?? "";
  const signature = request.headers.get("x-mac-pulse-signature")?.trim().toLowerCase() ?? "";
  const bucket = await authFailureBucket(request, /^[a-zA-Z0-9._-]{1,32}$/.test(keyId) ? keyId : "invalid");

  const failureLimited = await authFailureLimited(bucket);

  const signedHeadersPresent = Boolean(keyId || transportTimestamp || sampleId || signature);
  if (!signedHeadersPresent) {
    const legacyAllowed = process.env.ALLOW_LEGACY_INGEST_BEARER === "1" || process.env.NODE_ENV !== "production";
    const authorized = legacyAllowed && isAuthorized(request, "INGEST_TOKEN");
    if (authorized) {
      await getD1().prepare("DELETE FROM auth_failures WHERE bucket = ?").bind(bucket).run();
    } else if (!failureLimited) {
      await recordAuthFailure(bucket);
    }
    return {
      authorized,
      key_id: legacyAllowed ? "legacy" : null,
      legacy: true,
    };
  }

  const secret = heartbeatSecret(keyId);
  const fresh = transportTimestampIsFresh(transportTimestamp);
  const headersValid = Boolean(
    secret && fresh &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(sampleId) &&
    /^[0-9a-f]{64}$/.test(signature),
  );
  if (!headersValid || !secret) {
    if (!failureLimited) await recordAuthFailure(bucket);
    return { authorized: false, key_id: null, legacy: false };
  }

  const canonical = await canonicalHeartbeatInput(
    request.method,
    new URL(request.url).pathname,
    transportTimestamp,
    sampleId,
    body,
  );
  const expected = await hmacHex(secret, canonical);
  if (!constantTimeEqual(signature, expected)) {
    if (!failureLimited) await recordAuthFailure(bucket);
    return { authorized: false, key_id: null, legacy: false };
  }
  await getD1().prepare("DELETE FROM auth_failures WHERE bucket = ?").bind(bucket).run();
  return { authorized: true, key_id: keyId, legacy: false };
}

export function isAuthorized(request: Request, secretName: SecretName): boolean {
  const secret = getSecret(secretName);
  const header = request.headers.get("authorization") ?? "";
  return secret !== null && constantTimeEqual(header, `Bearer ${secret}`);
}

export type ViewerAuthMode = "siwc" | "token";

export function viewerAuthMode(request: Request): ViewerAuthMode | null {
  // Sites injects this header after its owner-only Sign in with ChatGPT gate.
  // The bearer fallback exists for local development and non-browser API tools.
  if (request.headers.get("oai-authenticated-user-id")?.trim()) return "siwc";
  return isAuthorized(request, "VIEW_TOKEN") ? "token" : null;
}

export const unauthorized = () =>
  Response.json(
    { error: "Unauthorized" },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": "Bearer",
      },
    },
  );
