import { test, expect } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";

const infoPaths = ["/faq", "/kvkk", "/privacy", "/accessibility", "/license"] as const;

for (const [locale, faqTitle] of [
  ["tr", "Sıkça Sorulan Sorular"],
  ["en", "Frequently Asked Questions"],
  ["de", "Häufige Fragen"],
] as const) {
  test(`public content is populated without signing in: ${locale}`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    for (const path of infoPaths) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page).toHaveURL(new RegExp(buildPath(path, {}, locale) + "$"));
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator("article")).not.toBeEmpty();
      await expect(page.locator("footer")).toHaveCount(1);
      if (path === "/faq") {
        await expect(page.locator("h1")).toHaveText(faqTitle);
        await expect(page.locator("details")).toHaveCount(16);
        for (const answer of await page.locator("details p").all()) {
          expect((await answer.textContent())?.trim().length).toBeGreaterThan(30);
        }
      } else {
        expect(await page.locator("article section").count()).toBeGreaterThanOrEqual(5);
        if (path === "/kvkk" || path === "/privacy") {
          await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, follow");
        }
      }
    }
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 390, 768, 1440]) {
  test(`footer and content fit ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript(value => localStorage.setItem("theme", value), theme);
      for (const path of ["/login", "/register", "/forgot-password", ...infoPaths]) {
        await page.goto(path);
        await expect(page.locator("footer")).toHaveCount(1);
        await page.locator("footer").scrollIntoViewIfNeeded();
        await expect(page.locator('footer a[href="mailto:pdassistant.info@gmail.com"]')).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
        const outOfBounds = await page.locator("footer a").evaluateAll(links => links.some(link => {
          const rect = link.getBoundingClientRect();
          return rect.left < -1 || rect.right > innerWidth + 1;
        }));
        expect(outOfBounds).toBe(false);
      }
    }
  });
}

test("footer links open the correct information and contributor targets", async ({ page }) => {
  await page.goto("/login");
  const footer = page.locator("footer");
  await expect(footer.getByRole("link", { name: "Alper Temiz GitHub profili" })).toHaveAttribute("href", "https://github.com/alperrte");
  await expect(footer.getByRole("link", { name: "Hamza Taşbay GitHub profili" })).toHaveAttribute("href", "https://github.com/HmzT270");
  await expect(footer.locator('a[href="mailto:pdassistant.info@gmail.com"]')).toBeVisible();
  for (const path of infoPaths) {
    await footer.locator('a[href="' + buildPath(path, {}, "tr") + '"]').click();
    await expect(page).toHaveURL(new RegExp(buildPath(path, {}, "tr") + "$"));
    await expect(page.locator("h1")).toBeVisible();
  }
});

test("FAQ opens with keyboard and skip link focuses the main content", async ({ page }) => {
  await page.goto("/faq");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "İçeriğe geç" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#public-main")).toBeFocused();
  const summary = page.locator("summary").first();
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("details").first()).toHaveAttribute("open", "");
  await expect(page.locator("details p").first()).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator("details").first()).not.toHaveAttribute("open");
});

test("authenticated app shell has no footer and information links work from the account menu", async ({ page, context }) => {
  await context.addCookies([{ name: "PDA_SESSION", value: "1", url: "http://localhost:3000" }]);
  await page.route("**/api/v1/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const data = path === "/api/v1/auth/me"
      ? { id: "footer-test-user", nickname: "FooterTest", email: "footer@example.com", globalRole: "USER", mustChangePassword: false }
      : path === "/api/v1/tasks/mine" ? { content: [], counts: {}, totalElements: 0, totalPages: 0 }
      : { content: [], totalElements: 0, totalPages: 0 };
    await route.fulfill({
      status: 200, contentType: "application/json",
      headers: { "access-control-allow-origin": "http://localhost:3000", "access-control-allow-credentials": "true" },
      body: JSON.stringify(data),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/settings");
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator("footer")).toHaveCount(0);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  for (const path of infoPaths) {
    await expect(menu.locator('a[href="' + buildPath(path, {}, "tr") + '"]')).toBeVisible();
  }
  await expect(menu.locator('a[href="mailto:pdassistant.info@gmail.com"]')).toBeVisible();
  await menu.locator('a[href="/tr/gizlilik"]').click();
  await expect(page).toHaveURL(/\/tr\/gizlilik$/);
  await expect(page.locator("h1")).toHaveText("Gizlilik Politikası");
});
