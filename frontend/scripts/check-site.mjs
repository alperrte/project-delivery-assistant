// Crawls the public site of a running instance and reports broken links and missing SEO / share metadata.
//
//   npm run build && npx next start -p 3100        (in one terminal)
//   node scripts/check-site.mjs http://localhost:3100   (in another; the base URL defaults to http://localhost:3000)
//
// Starting points are the URLs in /sitemap.xml. For each page it checks: status 200, exactly one canonical, a title and
// description, hreflang alternates that resolve, the Open Graph set (title, description, image, url, type) and Twitter card,
// a reachable og:image, and then that every same-site link on the page answers without an error. Links to other sites are
// only listed (a crawler must not depend on third parties being up). Exit code 1 when anything is wrong.

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const failures = [];
const fail = (page, message) => failures.push(`${page}: ${message}`);

const statusCache = new Map();
async function status(url) {
  if (!statusCache.has(url)) {
    statusCache.set(url, fetch(url, { redirect: "follow" }).then((r) => r.status).catch(() => 0));
  }
  return statusCache.get(url);
}

const sitemapText = await (await fetch(`${base}/sitemap.xml`)).text();
const pages = [...sitemapText.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, base));
if (pages.length === 0) {
  console.error("sitemap.xml lists no URL");
  process.exit(1);
}

const external = new Set();
let linkCount = 0;

for (const page of pages) {
  const res = await fetch(page, { redirect: "follow" });
  const html = await res.text();
  if (res.status !== 200) {
    fail(page, `status ${res.status}`);
    continue;
  }
  const meta = (attr, name) => html.match(new RegExp(`<meta[^>]+${attr}="${name}"[^>]*content="([^"]*)"`, "i"))?.[1]
    ?? html.match(new RegExp(`<meta[^>]+content="([^"]*)"[^>]*${attr}="${name}"`, "i"))?.[1];

  if (!/<title>[^<]+<\/title>/.test(html)) fail(page, "missing <title>");
  if (!meta("name", "description")) fail(page, "missing meta description");
  const canonicals = [...html.matchAll(/<link[^>]+rel="canonical"[^>]*>/g)];
  if (canonicals.length !== 1) fail(page, `${canonicals.length} canonical links (expected 1)`);
  for (const tag of ["og:title", "og:description", "og:image", "og:url", "og:type", "og:site_name"]) {
    if (!meta("property", tag)) fail(page, `missing ${tag}`);
  }
  if (!meta("name", "twitter:card")) fail(page, "missing twitter:card");

  const image = meta("property", "og:image");
  if (image) {
    const target = image.replace(/^https?:\/\/[^/]+/, base);
    const code = await status(target);
    if (code !== 200) fail(page, `og:image ${image} answers ${code}`);
    if (!/^https:\/\//.test(image) && !/^http:\/\/localhost/.test(image)) fail(page, `og:image is not absolute: ${image}`);
  }
  for (const link of html.matchAll(/<link[^>]+rel="alternate"[^>]*hreflang="[^"]+"[^>]*>/g)) {
    const href = link[0].match(/href="([^"]+)"/)?.[1];
    if (href && (await status(href.replace(/^https?:\/\/[^/]+/, base))) !== 200) fail(page, `hreflang target ${href} is broken`);
  }

  for (const anchor of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    const href = anchor[1].replace(/&amp;/g, "&");
    if (/^(mailto:|tel:|javascript:|#)/.test(href)) continue;
    // Backend endpoints (OAuth start links) are not pages: they answer 403 when that provider is not configured.
    if (/^(https?:\/\/[^/]+)?\/api\//.test(href)) continue;
    linkCount += 1;
    if (/^https?:\/\//.test(href) && !href.startsWith(base)) {
      external.add(href);
      continue;
    }
    const target = new URL(href, page).toString();
    const code = await status(target.split("#")[0]);
    if (code === 0 || code >= 400) fail(page, `link ${href} answers ${code}`);
  }
}

console.log(`Checked ${pages.length} pages and ${linkCount} links (${external.size} external, listed only).`);
for (const url of [...external].sort()) console.log(`  external: ${url}`);
if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const line of failures) console.error(`  - ${line}`);
  process.exit(1);
}
console.log("No broken links, canonical / Open Graph / Twitter / hreflang metadata complete.");
