import { test, expect } from "@playwright/test";

test("public login URLs select the URL language even when the cookie disagrees", async ({ request }) => {
  for (const [path, locale] of [["/tr/giris", "tr"], ["/en/login", "en"], ["/de/anmelden", "de"]]) {
    const response = await request.get(path, { headers: { Cookie: "NEXT_LOCALE=de" } });
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(`<html lang="${locale}"`);
  }
});

test("old and mismatched URLs have one canonical destination and retain query parameters", async ({ request }) => {
  const old = await request.get("/projects/example/tasks/board?page=2", {
    maxRedirects: 0,
    headers: { Cookie: "NEXT_LOCALE=tr" },
  });
  expect(old.status()).toBe(308);
  expect(old.headers().location).toBe("/tr/projeler/example/gorevler/pano?page=2");

  const mismatch = await request.get("/tr/projects/example/teams/new?section=teams", { maxRedirects: 0 });
  expect(mismatch.status()).toBe(308);
  expect(mismatch.headers().location).toBe("/tr/projeler/example/ekipler/yeni-ekip?section=teams");
});

test("redirects that depend on the language cookie are not cacheable", async ({ request }) => {
  for (const [path, cookie, destination] of [["/", "en", "/en/home"], ["/about", "tr", "/tr/hakkimizda"], ["/about", "de", "/de/ueber-uns"]]) {
    const response = await request.get(path, { maxRedirects: 0, headers: { Cookie: `NEXT_LOCALE=${cookie}` } });
    expect(response.status(), path).toBe(308);
    expect(response.headers().location, path).toBe(destination);
    expect(response.headers()["cache-control"], path).toBe("no-store");
  }
  // A prefixed URL never reads the cookie, so its redirect may be cached.
  const prefixed = await request.get("/tr/about", { maxRedirects: 0, headers: { Cookie: "NEXT_LOCALE=en" } });
  expect(prefixed.status()).toBe(308);
  expect(prefixed.headers()["cache-control"]).toBeUndefined();
});

test("the home page has a named URL per language and every other form redirects to it", async ({ request }) => {
  for (const [path, cookie, destination] of [
    ["/", "tr", "/tr/ana-sayfa"], ["/", "en", "/en/home"], ["/", "de", "/de/startseite"],
    ["/tr", "tr", "/tr/ana-sayfa"], ["/en", "en", "/en/home"], ["/de", "de", "/de/startseite"],
    ["/tr/home", "tr", "/tr/ana-sayfa"], ["/ana-sayfa", "en", "/en/home"],
  ]) {
    const response = await request.get(path, { maxRedirects: 0, headers: { Cookie: `NEXT_LOCALE=${cookie}` } });
    expect(response.status(), path).toBe(308);
    expect(response.headers().location, path).toBe(destination);
  }
  for (const [path, locale] of [["/tr/ana-sayfa", "tr"], ["/en/home", "en"], ["/de/startseite", "de"]]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(await response.text()).toContain(`<html lang="${locale}"`);
  }
});

test("project sections and create pages have their own named URL per language", async ({ request }) => {
  const cookie = { Cookie: "PDA_SESSION=1" };
  for (const path of [
    "/tr/projeler/x/genel-bakis", "/tr/projeler/x/kriterler", "/tr/projeler/x/ekipler", "/tr/projeler/x/ekip-davetleri",
    "/tr/projeler/x/depo", "/tr/projeler/x/duzenle", "/tr/projeler/yeni-proje", "/tr/organizasyonlar/yeni-organizasyon",
    "/tr/projeler/x/gorevler/yeni-gorev", "/tr/projeler/x/ekipler/yeni-ekip", "/tr/takvim/yeni-animsatici", "/tr/gorevlerim",
    "/en/projects/x/overview", "/en/projects/x/criteria", "/en/projects/x/teams", "/en/projects/x/team-invitations",
    "/en/projects/x/repository", "/en/projects/x/edit", "/en/projects/new-project", "/en/organizations/new-organization",
    "/en/projects/x/tasks/new-task", "/en/projects/x/teams/new-team", "/en/calendar/new-reminder", "/en/my-tasks",
    "/de/projekte/x/uebersicht", "/de/projekte/x/kriterien", "/de/projekte/x/teams", "/de/projekte/x/team-einladungen",
    "/de/projekte/x/repository", "/de/projekte/x/bearbeiten", "/de/projekte/neues-projekt", "/de/organisationen/neue-organisation",
    "/de/projekte/x/aufgaben/neue-aufgabe", "/de/projekte/x/teams/neues-team", "/de/kalender/neue-erinnerung", "/de/meine-aufgaben",
  ]) {
    const response = await request.get(path, { maxRedirects: 0, headers: cookie });
    expect(response.status(), path).toBe(200);
  }
});

test("older project section, create and my-tasks URLs redirect to the named URL", async ({ request }) => {
  const cookie = { Cookie: "PDA_SESSION=1" };
  for (const [path, destination] of [
    ["/tr/projeler/x", "/tr/projeler/x/genel-bakis"],
    ["/tr/projeler/x?section=criteria", "/tr/projeler/x/kriterler"],
    ["/tr/projeler/x?section=invitations&status=CANCELLED", "/tr/projeler/x/ekip-davetleri?status=CANCELLED"],
    ["/tr/projeler/x?section=settings", "/tr/projeler/x/duzenle"],
    ["/tr/projeler/x?section=repository&view=branches", "/tr/projeler/x/depo?view=branches"],
    ["/en/projects/x?section=settings", "/en/projects/x/edit"],
    ["/de/projekte/x?section=teams", "/de/projekte/x/teams"],
    ["/tr/projeler/yeni", "/tr/projeler/yeni-proje"],
    ["/tr/organizasyonlar/yeni", "/tr/organizasyonlar/yeni-organizasyon"],
    ["/tr/projeler/x/gorevler/yeni", "/tr/projeler/x/gorevler/yeni-gorev"],
    ["/tr/takvim/yeni?date=2026-10-09", "/tr/takvim/yeni-animsatici?date=2026-10-09"],
    ["/tr/gorevler", "/tr/gorevlerim"], ["/en/tasks", "/en/my-tasks"], ["/de/aufgaben", "/de/meine-aufgaben"],
  ]) {
    const response = await request.get(path, { maxRedirects: 0, headers: cookie });
    expect(response.status(), path).toBe(308);
    expect(response.headers().location, path).toBe(destination);
  }
});

test("project section pages carry their own title", async ({ request }) => {
  const cookie = { Cookie: "PDA_SESSION=1" };
  for (const [path, title] of [
    ["/tr/projeler/x/genel-bakis", "Genel bakış · PDA"], ["/tr/projeler/x/kriterler", "Kriterler · PDA"],
    ["/tr/projeler/x/ekipler", "Tüm ekipler · PDA"], ["/tr/projeler/x/ekip-davetleri", "Ekip davetleri · PDA"],
    ["/en/projects/x/team-invitations", "Team invitations · PDA"], ["/de/projekte/x/bearbeiten", "Projekt bearbeiten · PDA"],
  ]) {
    const html = await (await request.get(path, { headers: cookie })).text();
    expect(html, path).toContain(`<title>${title}</title>`);
  }
});

test("the home page carries valid structured data in the page language", async ({ request }) => {
  for (const [path, locale] of [["/tr/ana-sayfa", "tr"], ["/en/home", "en"], ["/de/startseite", "de"]]) {
    const html = await (await request.get(path)).text();
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    expect(blocks, path).toHaveLength(1);
    const graph = JSON.parse(blocks[0][1])["@graph"];
    expect(graph.map((node: { "@type": string }) => node["@type"]), path).toEqual(["Organization", "WebSite", "SoftwareApplication"]);
    expect(graph[2].inLanguage, path).toBe(locale);
    expect(graph[2].license, path).toBe("https://www.apache.org/licenses/LICENSE-2.0");
  }
});

test("public information pages declare their type and breadcrumb", async ({ request }) => {
  for (const [path, type, locale] of [
    ["/tr/hakkimizda", "AboutPage", "tr"], ["/en/about", "AboutPage", "en"], ["/de/ueber-uns", "AboutPage", "de"],
    ["/tr/sss", "WebPage", "tr"], ["/en/license", "WebPage", "en"], ["/de/barrierefreiheit", "WebPage", "de"],
    ["/tr/kvkk", "WebPage", "tr"], ["/en/privacy", "WebPage", "en"], ["/de/datenschutz", "WebPage", "de"],
    ["/tr/iletisim", "ContactPage", "tr"], ["/en/contact", "ContactPage", "en"], ["/de/kontakt", "ContactPage", "de"],
  ]) {
    const html = await (await request.get(path)).text();
    const graphs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1])).filter((block) => block["@graph"]);
    expect(graphs, path).toHaveLength(1);
    const [webpage, breadcrumb] = graphs[0]["@graph"];
    expect(webpage["@type"], path).toBe(type);
    expect(webpage.inLanguage, path).toBe(locale);
    expect(breadcrumb["@type"], path).toBe("BreadcrumbList");
    expect(breadcrumb.itemListElement.map((item: { position: number }) => item.position), path).toEqual([1, 2]);
  }
});

test("public information pages show the same breadcrumb they declare as structured data", async ({ page }) => {
  for (const [path, label, home, homeHref] of [
    ["/tr/hakkimizda", "Konum", "Ana sayfa", "/tr/ana-sayfa"], ["/en/faq", "Breadcrumb", "Home", "/en/home"], ["/de/datenschutz", "Brotkrumen", "Startseite", "/de/startseite"],
    ["/en/license", "Breadcrumb", "Home", "/en/home"], ["/tr/erisilebilirlik", "Konum", "Ana sayfa", "/tr/ana-sayfa"],
    ["/tr/iletisim", "Konum", "Ana sayfa", "/tr/ana-sayfa"], ["/de/kontakt", "Brotkrumen", "Startseite", "/de/startseite"],
  ]) {
    await page.goto(path);
    const trail = page.getByRole("navigation", { name: label, exact: true });
    await expect(trail.getByRole("listitem"), path).toHaveCount(2);
    await expect(trail.getByRole("link", { name: home }), path).toHaveAttribute("href", homeHref);
    const current = trail.locator("[aria-current=page]");
    await expect(current, path).toHaveText((await page.locator("h1").innerText()).trim());
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').allInnerTexts()).find(text => text.includes("BreadcrumbList"))!);
    const names = ld["@graph"][1].itemListElement.map((item: { name: string }) => item.name);
    expect(names, path).toEqual([home, (await current.innerText()).trim()]);
    await expect(page.locator("h1"), path).toHaveCount(1);
  }
});

test("the FAQ page lists every visible question as structured data", async ({ page }) => {
  for (const path of ["/tr/sss", "/en/faq", "/de/faq"]) {
    await page.goto(path);
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
    const entity = blocks.map((block) => JSON.parse(block)).find((block) => block["@type"] === "FAQPage");
    expect(entity, path).toBeDefined();
    const visible = await page.locator("details > summary").allInnerTexts();
    expect(entity.mainEntity.map((item: { name: string }) => item.name), path).toEqual(visible.map((text) => text.trim()));
    expect(entity.mainEntity[0].acceptedAnswer.text.length, path).toBeGreaterThan(20);
  }
});

test("public pages declare x-default, the page language and a 1200x630 share image", async ({ page, request }) => {
  for (const [path, locale, ogLocale] of [["/tr/ana-sayfa", "tr", "tr_TR"], ["/en/faq", "en", "en_US"], ["/de/anmelden", "de", "de_DE"], ["/en/contact", "en", "en_US"]]) {
    await page.goto(path);
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]'), path).toHaveAttribute("href", /\/tr\//);
    await expect(page.locator('meta[property="og:locale"]'), path).toHaveAttribute("content", ogLocale);
    await expect(page.locator('meta[property="og:locale:alternate"]'), path).toHaveCount(2);
    await expect(page.locator('meta[property="og:image:width"]'), locale).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]'), locale).toHaveAttribute("content", "630");
  }
  const image = await (await request.get("/images/branding/og-image.png")).body();
  expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([1200, 630]);
  expect(await (await request.get("/sitemap.xml")).text()).toContain('hreflang="x-default"');
});

test("every public page carries a complete share card: title, description, own url, site name, type, image and Twitter tags", async ({ page }) => {
  const paths = ["/tr/ana-sayfa", "/en/home", "/de/startseite", "/tr/giris", "/en/register", "/de/passwort-vergessen", "/tr/hakkimizda", "/en/faq", "/de/kontakt", "/tr/cerez-politikasi", "/en/license", "/de/barrierefreiheit", "/en/privacy", "/tr/kvkk"];
  for (const path of paths) {
    await page.goto(path);
    const content = (selector: string) => page.locator(selector).first().getAttribute("content");
    const origin = new URL(page.url()).origin;
    // The home page shares its marketing headline; the tab title there is just "Home".
    const isHome = ["/tr/ana-sayfa", "/en/home", "/de/startseite"].includes(path);
    const title = isHome ? await content('meta[property="og:title"]') : await page.title();

    expect(await content('meta[property="og:url"]'), path).toBe(`${origin}${path}`);
    expect((await content('meta[property="og:title"]'))?.length, path).toBeGreaterThan(5);
    expect(await content('meta[property="og:title"]'), path).toBe(title);
    expect((await content('meta[property="og:description"]'))?.length, path).toBeGreaterThan(20);
    expect(await content('meta[property="og:type"]'), path).toBe("website");
    expect(await content('meta[property="og:site_name"]'), path).toBe("PDA · Project Delivery Assistant");
    expect(await content('meta[property="og:image"]'), path).toBe(`${origin}/images/branding/og-image.png`);
    expect(await content('meta[property="og:image:type"]'), path).toBe("image/png");
    expect((await content('meta[property="og:image:alt"]'))?.length, path).toBeGreaterThan(3);

    expect(await content('meta[name="twitter:card"]'), path).toBe("summary_large_image");
    expect(await content('meta[name="twitter:title"]'), path).toBe(title);
    expect(await content('meta[name="twitter:image"]'), path).toBe(`${origin}/images/branding/og-image.png`);
  }
});

test("the home page has one h1; the product demo uses h2 for its screen titles", async ({ page }) => {
  await page.goto("/tr/ana-sayfa");
  await expect(page.locator("h1")).toHaveCount(1);
});

test("llms.txt summarises the site for AI assistants and links every public page in each language", async ({ request }) => {
  const response = await request.get("/llms.txt");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const text = await response.text();
  expect(text.startsWith("# PDA · Project Delivery Assistant")).toBe(true);
  for (const path of ["/tr/ana-sayfa", "/en/faq", "/de/ueber-uns", "/tr/lisans", "/de/barrierefreiheit"]) expect(text, path).toContain(path);
  expect(text).toContain("Apache License 2.0");
});

test("protected localized deep links go to the same-language login", async ({ request }) => {
  const response = await request.get("/de/projekte/pda-backend/aufgaben/board?page=2", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const destination = new URL(response.headers().location, "http://localhost");
  expect(destination.pathname).toBe("/de/anmelden");
  expect(destination.searchParams.get("next")).toBe("/de/projekte/pda-backend/aufgaben/board?page=2");
});

test("every protected page sends a visitor without a session to the login of the same language; public pages stay open", async ({ request }) => {
  const protectedPages: Record<string, string[]> = {
    tr: ["/tr/genel-bakis", "/tr/projeler", "/tr/projeler/yeni-proje", "/tr/projeler/x/ekipler", "/tr/projeler/x/duzenle", "/tr/projeler/x/gorevler/pano", "/tr/organizasyonlar", "/tr/organizasyonlar/yeni-organizasyon", "/tr/ayarlar", "/tr/hesap", "/tr/gorevlerim", "/tr/takvim", "/tr/takvim/yeni-animsatici", "/tr/davetler", "/tr/sifre-degistir", "/tr/yonetim", "/tr/yonetim/kullanicilar", "/tr/yonetim/analitik"],
    en: ["/en/dashboard", "/en/projects", "/en/projects/new-project", "/en/projects/x/teams", "/en/projects/x/edit", "/en/projects/x/tasks/board", "/en/organizations", "/en/settings", "/en/account", "/en/my-tasks", "/en/calendar", "/en/invitations", "/en/change-password", "/en/admin", "/en/admin/users"],
    de: ["/de/uebersicht", "/de/projekte", "/de/projekte/x/teams", "/de/organisationen", "/de/einstellungen", "/de/konto", "/de/meine-aufgaben", "/de/kalender", "/de/einladungen", "/de/passwort-aendern", "/de/verwaltung/analyse"],
  };
  const login = { tr: "/tr/giris", en: "/en/login", de: "/de/anmelden" };
  for (const [locale, paths] of Object.entries(protectedPages)) {
    for (const path of paths) {
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      const destination = new URL(response.headers().location, "http://localhost");
      expect(destination.pathname, path).toBe(login[locale as keyof typeof login]);
      expect(destination.searchParams.get("next"), path).toBe(path);
    }
  }
  for (const path of ["/tr/giris", "/tr/kayit", "/tr/sifremi-unuttum", "/en/faq", "/de/ueber-uns", "/tr/lisans"]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(200);
  }
});

test("uppercase addresses redirect to the lowercase canonical URL and keep the query", async ({ request }) => {
  for (const [from, to] of [
    ["/tr/Hakkimizda", "/tr/hakkimizda"],
    ["/TR/hakkimizda", "/tr/hakkimizda"],
    ["/En/About?x=1", "/en/about?x=1"],
    ["/DE/Datenschutz", "/de/datenschutz"],
    ["/TR/Giris", "/tr/giris"],
    ["/tr/projeler/Yeni-Proje", "/tr/projeler/yeni-proje"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(308);
    expect(new URL(response.headers().location, "http://localhost").pathname + new URL(response.headers().location, "http://localhost").search, from).toBe(to);
  }
  // A prefixed uppercase URL does not depend on the language cookie, so it may be cached.
  const prefixed = await request.get("/TR/hakkimizda", { maxRedirects: 0 });
  expect(prefixed.headers()["cache-control"]).toBeUndefined();
});

test("unknown localized pages remain 404", async ({ request }) => {
  const response = await request.get("/tr/bilinmeyen");
  expect(response.status()).toBe(404);
  const malformed = await request.get("/tr/projeler/%ZZ");
  expect(malformed.status()).toBe(404);
});

test("language switch keeps the logical page and query", async ({ page }) => {
  await page.goto("/tr/giris?next=%2Ftr%2Fprojeler");
  await page.getByRole("button", { name: "Dil" }).click();
  await page.getByRole("menuitem", { name: /English/ }).click();
  await expect(page).toHaveURL(/\/en\/login\?next=%2Ftr%2Fprojeler$/);
});

test("public canonical, hreflang, sitemap and robots agree on localized paths", async ({ page, request }) => {
  await page.goto("/de/barrierefreiheit");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/de\/barrierefreiheit$/);
  await expect(page.locator('link[rel="alternate"][hreflang="tr"]')).toHaveAttribute("href", /\/tr\/erisilebilirlik$/);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/tr/erisilebilirlik");
  expect(sitemap).toContain("/en/accessibility");
  expect(sitemap).toContain("/de/barrierefreiheit");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /de/projekte");
  expect(robots).toContain("Disallow: /de/meine-aufgaben");
  expect(robots).toContain("Disallow: /en/my-tasks");
  expect(robots).toContain("Disallow: /tr/gorevlerim");
  expect(robots).not.toContain("Disallow: /de/barrierefreiheit");
  // `noindex` is only read when crawlers may fetch the page, so the reset form is not disallowed.
  expect(robots).not.toContain("sifremi-unuttum");
  await page.goto("/tr/sifremi-unuttum");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
});
