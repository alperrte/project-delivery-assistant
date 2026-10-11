#!/usr/bin/env node
// Per-route client JavaScript size (gzip) read from the production build in `.next`, checked against `bundle-budgets.json`.
//
//   node scripts/check-bundle-size.mjs            report + compare with the budgets, exit 1 above a budget
//   node scripts/check-bundle-size.mjs --warn     same report, but always exit 0 (used by the pre-push gate)
//   node scripts/check-bundle-size.mjs --json     print the measured sizes as JSON (to set or refresh the budgets)
//
// "Initial JS" of a route = every script the browser must load before the route is interactive: the shared runtime
// (`rootMainFiles`; the `nomodule` polyfill file is not downloaded by current browsers and is left out) plus the chunks of every client module the route's server tree references (layouts included).
// Chunks behind `next/dynamic` / `import()` are loaded later on demand and are deliberately not counted; that is the point
// of splitting them out. Run `npm run build` first.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const nextDir = join(root, ".next");
const args = new Set(process.argv.slice(2));

if (!existsSync(join(nextDir, "build-manifest.json"))) {
  console.error("No production build found in .next - run `npm run build` first.");
  process.exit(args.has("--warn") ? 0 : 2);
}

const gzipCache = new Map();
function gzipSize(chunk) {
  const file = join(nextDir, chunk.replace(/^\/?_next\//, "").replace(/^\//, ""));
  if (!gzipCache.has(file)) gzipCache.set(file, existsSync(file) ? gzipSync(readFileSync(file)).length : 0);
  return gzipCache.get(file);
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const buildManifest = JSON.parse(readFileSync(join(nextDir, "build-manifest.json"), "utf8"));
const shared = [...(buildManifest.rootMainFiles ?? [])].filter((f) => f.endsWith(".js"));

/** "/(auth)/login/page" -> "/login"; "/page" -> "/" */
function routeOf(key) {
  const route = key
    .replace(/\/page$/, "")
    .split("/")
    .filter((segment) => segment && !/^\(.*\)$/.test(segment))
    .join("/");
  return `/${route}`;
}

const routes = {};
for (const file of walk(join(nextDir, "server", "app")).filter((f) => f.endsWith("page_client-reference-manifest.js"))) {
  const source = readFileSync(file, "utf8");
  const match = source.match(/__RSC_MANIFEST\["([^"]+)"\]\s*=\s*(\{.*\})\s*;?\s*$/s);
  if (!match) continue;
  const manifest = JSON.parse(match[2]);
  const chunks = new Set(shared.map((f) => `/_next/${f}`));
  for (const clientModule of Object.values(manifest.clientModules ?? {})) {
    for (const chunk of clientModule.chunks ?? []) if (chunk.endsWith(".js")) chunks.add(chunk);
  }
  const bytes = [...chunks].reduce((sum, chunk) => sum + gzipSize(chunk), 0);
  routes[routeOf(match[1])] = { gzipKB: Math.round((bytes / 1024) * 10) / 10, chunks: chunks.size };
}

if (args.has("--json")) {
  console.log(JSON.stringify(Object.fromEntries(Object.entries(routes).sort().map(([r, v]) => [r, v.gzipKB])), null, 2));
  process.exit(0);
}

const budgetFile = join(root, "bundle-budgets.json");
const budgets = existsSync(budgetFile) ? JSON.parse(readFileSync(budgetFile, "utf8")) : { routes: {} };
const limits = budgets.routes ?? {};
let failed = 0;

console.log(`Initial client JS per route (gzip, KB) - budgets from ${relative(root, budgetFile).split(sep).join("/")}`);
console.log("route".padEnd(48), "size".padStart(9), "budget".padStart(9), "chunks".padStart(7));
for (const [route, { gzipKB, chunks }] of Object.entries(routes).sort(([a], [b]) => a.localeCompare(b))) {
  const limit = limits[route] ?? budgets.default;
  const over = typeof limit === "number" && gzipKB > limit;
  if (over) failed += 1;
  console.log(
    route.padEnd(48),
    gzipKB.toFixed(1).padStart(9),
    (typeof limit === "number" ? limit.toFixed(0) : "-").padStart(9),
    String(chunks).padStart(7),
    over ? " OVER BUDGET" : "",
  );
}

if (failed > 0) {
  console.error(`\n${failed} route(s) above their bundle budget. Split the code (next/dynamic) or raise the budget in bundle-budgets.json with a reason.`);
  process.exit(args.has("--warn") ? 0 : 1);
}
console.log("\nAll routes within budget.");
