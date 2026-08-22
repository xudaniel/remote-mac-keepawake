import assert from "node:assert/strict";
import test from "node:test";

import { viewerCorsPreflight, withViewerCors } from "../lib/cors.ts";

test("viewer CORS is exact-origin, read-only, and disabled by default", () => {
  const previous = process.env.PUBLIC_VIEWER_ORIGIN;
  try {
    delete process.env.PUBLIC_VIEWER_ORIGIN;
    const unconfigured = withViewerCors(
      new Request("https://dashboard.example/api/status", { headers: { origin: "https://xudaniel.github.io" } }),
      Response.json({ ok: true }),
    );
    assert.equal(unconfigured.headers.get("access-control-allow-origin"), null);

    process.env.PUBLIC_VIEWER_ORIGIN = "https://xudaniel.github.io";
    const allowedRequest = new Request("https://dashboard.example/api/status", {
      method: "OPTIONS",
      headers: { origin: "https://xudaniel.github.io" },
    });
    const preflight = viewerCorsPreflight(allowedRequest);
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://xudaniel.github.io");
    assert.equal(preflight.headers.get("access-control-allow-methods"), "GET, OPTIONS");
    assert.doesNotMatch(preflight.headers.get("access-control-allow-methods") || "", /POST|PUT|PATCH|DELETE/);
    assert.match(preflight.headers.get("access-control-allow-headers") || "", /Authorization/);

    const rejected = viewerCorsPreflight(
      new Request("https://dashboard.example/api/status", {
        method: "OPTIONS",
        headers: { origin: "https://attacker.example" },
      }),
    );
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);

    const response = withViewerCors(allowedRequest, Response.json({ ok: true }, { headers: { "X-Test": "preserved" } }));
    assert.equal(response.headers.get("access-control-allow-origin"), "https://xudaniel.github.io");
    assert.equal(response.headers.get("x-test"), "preserved");
    assert.equal(response.headers.get("vary"), "Origin");
  } finally {
    if (previous === undefined) delete process.env.PUBLIC_VIEWER_ORIGIN;
    else process.env.PUBLIC_VIEWER_ORIGIN = previous;
  }
});
