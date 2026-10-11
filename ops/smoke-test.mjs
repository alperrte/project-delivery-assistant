// Post-deployment smoke test of a PDA site behind HTTPS (docker-compose.prod.yml + Caddy, or any equivalent).
//
//   node ops/smoke-test.mjs https://pda.example.org
//   NODE_EXTRA_CA_CERTS=<caddy-local-root.crt> node ops/smoke-test.mjs https://localhost      (trying the stack on one machine:
//   `docker compose -f docker-compose.prod.yml cp caddy:/data/caddy/pki/authorities/local/root.crt caddy-local-root.crt`;
//   certificate checks stay ON, the local root is simply trusted for this one run)
//
// Checks, in order: http:// redirects to https://; the security headers of a page and of the API; the policy really is
// the https one (upgrade-insecure-requests, wss/https API origin); the API answers through the proxy and its cookie is Secure;
// the WebSocket route reaches the backend (401, not 502); sitemap/robots/manifest/service worker are served; the public pages
// have no broken links or missing metadata (frontend/scripts/check-site.mjs). Exit code 1 when anything is wrong.
import { spawnSync } from "node:child_process";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const site = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(site)) {
  console.error("Usage: node ops/smoke-test.mjs https://<site>");
  process.exit(1);
}
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures.push(name);
};
const get = (url, init = {}) => fetch(url, { redirect: "manual", ...init });

// 1. http -> https
const httpUrl = site.replace(/^https:/, "http:");
try {
  const r = await get(`${httpUrl}/tr/giris`);
  check("http:// redirects to https://", [301, 302, 307, 308].includes(r.status) && (r.headers.get("location") ?? "").startsWith("https://"), `${r.status} -> ${r.headers.get("location")}`);
} catch (error) {
  check("http:// redirects to https://", false, `no answer on port 80: ${error.cause?.code ?? error.message}`);
}

// 2. page headers
const page = await get(`${site}/tr/giris`);
const h = (name) => page.headers.get(name) ?? "";
check("page answers 200", page.status === 200, String(page.status));
check("Strict-Transport-Security (>= 1 year)", /max-age=(\d+)/.test(h("strict-transport-security")) && Number(h("strict-transport-security").match(/max-age=(\d+)/)[1]) >= 31536000, h("strict-transport-security"));
const csp = h("content-security-policy");
check("CSP: nonce + strict-dynamic, no unsafe-inline/eval in script-src", /script-src[^;]*'nonce-[^']+'[^;]*'strict-dynamic'/.test(csp) && !/script-src[^;]*'unsafe-(inline|eval)'/.test(csp));
check("CSP: frame-ancestors none, object-src none", /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp));
check("CSP: upgrade-insecure-requests", /upgrade-insecure-requests/.test(csp));
check("CSP: connect-src names the https/wss origin of this site", csp.includes(`connect-src 'self' ${site} wss://${new URL(site).host}`));
check("X-Content-Type-Options nosniff", h("x-content-type-options") === "nosniff");
check("X-Frame-Options DENY", h("x-frame-options") === "DENY");
check("Referrer-Policy set", h("referrer-policy") !== "");
check("no server version leak (X-Powered-By absent)", !h("x-powered-by"), h("x-powered-by"));

// 3. API through the proxy
const csrf = await get(`${site}/api/v1/auth/csrf`);
const setCookie = csrf.headers.getSetCookie?.() ?? [];
check("API answers through the proxy", csrf.status === 200, String(csrf.status));
check("API: restrictive CSP and no-referrer", /default-src 'none'/.test(csrf.headers.get("content-security-policy") ?? "") && csrf.headers.get("referrer-policy") === "no-referrer");
check("API cookie is Secure", setCookie.length > 0 && setCookie.every((c) => /;\s*Secure/i.test(c)), `${setCookie.length} cookie(s)`);
const docs = await get(`${site}/swagger-ui/index.html`);
check("API docs are not public", docs.status !== 200, String(docs.status));
const actuator = await get(`${site}/api/v1/actuator/health`);
check("no actuator route under /api", actuator.status !== 200, String(actuator.status));

// 4. WebSocket route reaches the backend (an unauthenticated upgrade is refused with 401, a broken route would be 502/404)
// (fetch refuses an Upgrade header, so this one uses node:https directly)
const wsStatus = await new Promise((resolve) => {
  const request = https.request(`${site}/api/v1/ws`, { method: "GET", headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": randomBytes(16).toString("base64") } }, (response) => { resolve(response.statusCode); response.resume(); });
  request.on("upgrade", () => resolve(101));
  request.on("error", () => resolve(0));
  request.end();
});
const ws = { status: wsStatus };
check("WebSocket route reaches the backend (401)", ws.status === 401, String(ws.status));

// 5. static files
for (const file of ["sitemap.xml", "robots.txt", "manifest.webmanifest", "sw.js", "offline.html", "llms.txt"]) {
  const r = await get(`${site}/${file}`);
  check(`/${file} is served`, r.status === 200, String(r.status));
}
const sw = await get(`${site}/sw.js`);
check("sw.js is never cached", /no-cache|no-store/.test(sw.headers.get("cache-control") ?? ""), sw.headers.get("cache-control") ?? "");

// 6. broken links and metadata of every public page
const crawl = spawnSync(process.execPath, [path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "frontend", "scripts", "check-site.mjs"), site], { encoding: "utf8" });
check("public pages: no broken links, complete metadata (check-site)", crawl.status === 0, (crawl.stdout.trim().split("\n")[0] || crawl.stderr.trim().split("\n")[0] || "").slice(0, 100));
if (crawl.status !== 0) console.log(crawl.stdout + crawl.stderr);

console.log(failures.length ? `\n${failures.length} check(s) failed.` : "\nSmoke test passed.");
process.exit(failures.length ? 1 : 0);
