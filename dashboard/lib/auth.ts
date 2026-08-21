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

function constantTimeEqual(left: string, right: string): boolean {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
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
