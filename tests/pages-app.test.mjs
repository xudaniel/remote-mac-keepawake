import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ships a self-contained bilingual GitHub Pages app", async () => {
  const [html, css, script, manifest] = await Promise.all([
    read("pages/index.html"),
    read("pages/app.css"),
    read("pages/app.js"),
    read("pages/manifest.webmanifest"),
  ]);
  assert.match(html, /Mac Pulse — Live Remote Mac Monitor/);
  assert.match(html, /Public demo/);
  assert.match(html, /synthetic/);
  assert.match(html, /id="battery-data-kind">Synthetic data/);
  assert.match(html, /Connect private data/);
  assert.match(html, /Never enter the heartbeat ingest\/signing key/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<dialog/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /<script[^>]+https?:|<link[^>]+href="https?:/);
  assert.match(css, /min-width: 320px/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(script, /zh:/);
  assert.match(script, /Private live data/);
  assert.match(script, /REFRESH_INTERVAL_MS = 60_000/);
  assert.doesNotMatch(script, /REFRESH_INTERVAL_MS = 10_000|every 10 seconds|每 10 秒/);
  const parsed = JSON.parse(manifest);
  assert.equal(parsed.display, "standalone");
  assert.equal(parsed.start_url, "./");
});

test("keeps private viewer credentials session-only and out of URLs", async () => {
  const script = await read("pages/app.js");
  assert.match(script, /sessionStorage\.setItem\(SESSION_KEY/);
  assert.match(script, /sessionStorage\.removeItem\(SESSION_KEY/);
  assert.doesNotMatch(script, /localStorage|document\.cookie/);
  assert.match(script, /url\.protocol !== "https:"/);
  assert.match(script, /url\.username \|\| url\.password \|\| url\.search \|\| url\.hash/);
  assert.match(script, /credentials: "omit"/);
  assert.match(script, /referrerPolicy: "no-referrer"/);
  assert.match(script, /Authorization: `Bearer \$\{connection\.viewToken\}`/);
  assert.match(script, /OAI-Sites-Authorization/);
  assert.doesNotMatch(script, /INGEST_TOKEN|ingest-token|local-ingest-token/);
});

test("allows only an explicitly configured origin to read status and history", async () => {
  const [cors, status, history, example] = await Promise.all([
    read("dashboard/lib/cors.ts"),
    read("dashboard/app/api/status/route.ts"),
    read("dashboard/app/api/history/route.ts"),
    read("dashboard/.env.example"),
  ]);
  assert.match(cors, /PUBLIC_VIEWER_ORIGIN/);
  assert.match(cors, /origin === configured/);
  assert.match(cors, /"Access-Control-Allow-Methods": "GET, OPTIONS"/);
  assert.doesNotMatch(cors, /Access-Control-Allow-Origin[^\n]+\*/);
  assert.match(status, /withViewerCors\(request, unauthorized\(\)\)/);
  assert.match(history, /withViewerCors\(request, unauthorized\(\)\)/);
  assert.match(status, /export async function OPTIONS/);
  assert.match(history, /export async function OPTIONS/);
  assert.match(example, /PUBLIC_VIEWER_ORIGIN=https:\/\/xudaniel\.github\.io/);
});

test("uses pinned GitHub-owned deployment actions and least privilege", async () => {
  const workflow = await read(".github/workflows/pages.yml");
  assert.match(workflow, /actions\/checkout@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/configure-pages@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/upload-pages-artifact@[0-9a-f]{40}/);
  assert.match(workflow, /actions\/deploy-pages@[0-9a-f]{40}/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /path: pages/);
});

test("service worker caches only same-origin static GET requests", async () => {
  const worker = await read("pages/sw.js");
  assert.match(worker, /event\.request\.method !== "GET"/);
  assert.match(worker, /url\.origin !== self\.location\.origin/);
  assert.doesNotMatch(worker, /Authorization|OAI-Sites-Authorization/);
});
