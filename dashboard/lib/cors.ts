const VIEWER_HEADERS = "Authorization, OAI-Sites-Authorization";

function configuredViewerOrigin() {
  const configured = process.env.PUBLIC_VIEWER_ORIGIN?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin")?.trim();
  const configured = configuredViewerOrigin();
  return origin && configured && origin === configured ? origin : null;
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": VIEWER_HEADERS,
    "Access-Control-Max-Age": "600",
    "Cache-Control": "no-store",
    Vary: "Origin",
  };
}

export function withViewerCors(request: Request, response: Response) {
  const origin = allowedOrigin(request);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(origin))) headers.set(name, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function viewerCorsPreflight(request: Request) {
  const origin = allowedOrigin(request);
  if (!origin) return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}
