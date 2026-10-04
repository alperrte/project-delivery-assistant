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
  expect(mismatch.headers().location).toBe("/tr/projeler/example/ekipler/yeni?section=teams");
});

test("protected localized deep links go to the same-language login", async ({ request }) => {
  const response = await request.get("/de/projekte/pda-backend/aufgaben/tafel?page=2", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const destination = new URL(response.headers().location, "http://localhost");
  expect(destination.pathname).toBe("/de/anmelden");
  expect(destination.searchParams.get("next")).toBe("/de/projekte/pda-backend/aufgaben/tafel?page=2");
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
