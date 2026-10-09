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

test("protected localized deep links go to the same-language login", async ({ request }) => {
  const response = await request.get("/de/projekte/pda-backend/aufgaben/board?page=2", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const destination = new URL(response.headers().location, "http://localhost");
  expect(destination.pathname).toBe("/de/anmelden");
  expect(destination.searchParams.get("next")).toBe("/de/projekte/pda-backend/aufgaben/board?page=2");
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
  expect(robots).not.toContain("Disallow: /de/barrierefreiheit");
});
