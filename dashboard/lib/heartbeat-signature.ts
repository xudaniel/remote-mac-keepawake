export const SIGNATURE_WINDOW_SECONDS = 300;

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string) {
  return bytesToHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

export async function hmacHex(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
}

export async function canonicalHeartbeatInput(
  method: string,
  pathname: string,
  transportTimestamp: string,
  sampleId: string,
  exactBody: string,
) {
  return [method.toUpperCase(), pathname, transportTimestamp, sampleId, await sha256Hex(exactBody)].join("\n");
}

export function transportTimestampIsFresh(
  transportTimestamp: string,
  now = Date.now(),
  windowSeconds = SIGNATURE_WINDOW_SECONDS,
) {
  const transportMs = Date.parse(transportTimestamp);
  return Number.isFinite(transportMs) && Math.abs(now - transportMs) <= windowSeconds * 1_000;
}

export function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}
