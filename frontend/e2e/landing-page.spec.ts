import { test, expect } from "@playwright/test";

for (const [locale, heading, criteria] of [
  ["tr", "Fikirden teslimata.", "Başarı kriterleri"],
  ["en", "From idea to delivery.", "Success criteria"],
  ["de", "Von der Idee zum Ziel.", "Erfolgskriterien"],
] as const) {
  test(`landing content and preview work in ${locale}`, async ({ page, context }) => {
    const errors: string[] = [];
    const apiRequests: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (request.url().includes("/api/v1/")) apiRequests.push(request.url()); });
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    const response = await page.goto("/");
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText(heading);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("footer")).toHaveCount(1);
    await expect(page.locator('main a[href="/register"]').first()).toBeVisible();
    await page.getByRole("button", { name: criteria, exact: true }).click();
    await expect(page.getByRole("button", { name: criteria, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('#product-preview img[src*="project-criteria"]:visible')).toHaveCount(1);
    const image = page.locator('#product-preview img:visible');
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
    await expect(page).toHaveTitle(/PDA/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
    const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    expect(canonical).toBeTruthy();
    expect(new URL(canonical!).pathname).toBe("/");
    expect(new URL(canonical!).search).toBe("");
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`landing fits ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(value => { try { localStorage.setItem("theme", value); } catch {} }, theme);
      await page.goto("/");
      await expect(page.locator("h1")).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      const escaped = await page.locator('header a:visible, header button:visible, main a:visible, main button:visible, footer a:visible').evaluateAll(elements => elements.filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      }).map(element => element.textContent));
      expect(escaped).toEqual([]);
      await expect(page.locator('footer a[href="mailto:pda-info@gmail.com"]')).toHaveAttribute("href", "mailto:pda-info@gmail.com");
      expect(await page.locator('#product-preview img:visible').getAttribute('src')).toContain(`-${theme}-v1.webp`);
    }
  });
}

test("landing links reach registration, login and FAQ", async ({ page }) => {
  await page.goto("/");
  await page.locator('main a[href="/register"]').first().click();
  await expect(page).toHaveURL(/\/register$/);
  await page.goto("/");
  await page.locator('header a[href="/login"]').click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await page.locator('footer a[href="/faq"]').click();
  await expect(page).toHaveURL(/\/faq$/);
});

test("skip link, keyboard preview and reduced motion work", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "İçeriğe geç", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#landing-main")).toBeFocused();
  const criteria = page.getByRole("button", { name: "Başarı kriterleri", exact: true });
  await criteria.focus();
  await page.keyboard.press("Enter");
  await expect(criteria).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("#product-preview").evaluate(el => getComputedStyle(el).transform)).toBe("none");
});

test("session hint routes to the verified app shell", async ({ page, context }) => {
  await context.addCookies([{ name: "PDA_SESSION", value: "1", url: "http://localhost:3000" }]);
  await page.route("**/api/v1/**", route => route.fulfill({
    status: 200, contentType: "application/json",
    headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
    body: JSON.stringify(new URL(route.request().url()).pathname.endsWith("/auth/me")
      ? { id: "landing-test", nickname: "LandingTest", email: "landing@example.com", globalRole: "USER", mustChangePassword: false }
      : { content: [], totalElements: 0, totalPages: 0, counts: {} }),
  }));
  await page.goto("/");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator("footer")).toHaveCount(0);
});

test("landing content and CTA render without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, locale: "tr-TR" });
  const page = await context.newPage();
  await page.goto("http://localhost:3000/");
  await expect(page.locator("h1")).toContainText("Fikirden teslimata.");
  await expect(page.locator('main a[href="/register"]').first()).toBeVisible();
  await context.close();
});

test("homepage is discoverable in sitemap and robots", async ({ request }) => {
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toMatch(/<loc>[^<]+\/<\/loc>/);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Allow: /");
  expect(await robots.text()).toContain("Disallow: /dashboard");
});
