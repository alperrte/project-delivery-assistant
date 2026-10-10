import { test, expect, type Locator, type Page } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";

const infoPaths = ["/about", "/faq", "/kvkk", "/privacy", "/terms", "/cookies", "/accessibility", "/license"] as const;
const EMAIL = "pdassistant.info@gmail.com";

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
        await expect(page.locator("details")).toHaveCount(23);
        for (const answer of await page.locator("details p").all()) {
          expect((await answer.textContent())?.trim().length).toBeGreaterThan(30);
        }
      } else {
        expect(await page.locator("article section").count()).toBeGreaterThanOrEqual(path === "/about" ? 4 : 5);
        // Every information page is final and indexable: no robots meta tag, no review notice, no placeholder wording.
        await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
        await expect(page.locator("article")).not.toContainText(/HUKUKİ İÇERİK|teyit edilmemiştir|Yayın öncesi|Review before launch|Prüfung vor Veröffentlichung/);
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
        await expect(page.locator('footer a[href="/tr/iletisim"]')).toBeVisible();
        await expect(page.locator('footer a[href^="mailto:"]')).toHaveAttribute("href", "mailto:" + EMAIL);
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
  await expect(footer.locator('a[href="/tr/iletisim"]')).toBeVisible();
  // The one public address is shown next to the contact link (and is the same constant JSON-LD and llms.txt use).
  await expect(footer.locator('a[href^="mailto:"]')).toHaveText(EMAIL);
  await expect(footer.locator('a[href^="mailto:"]')).toHaveAttribute("href", "mailto:" + EMAIL);
  await expect(footer.getByRole("link", { name: "KVKK Aydınlatma Metni" })).toHaveAttribute("href", "/tr/kvkk");
  await expect(footer.getByRole("link", { name: "Kullanım Koşulları" })).toHaveAttribute("href", "/tr/kullanim-kosullari");
  for (const path of infoPaths) {
    await footer.locator('a[href="' + buildPath(path, {}, "tr") + '"]').click();
    await expect(page).toHaveURL(new RegExp(buildPath(path, {}, "tr") + "$"));
    await expect(page.locator("h1")).toBeVisible();
  }
});

for (const [locale, label] of [["tr", "Sürüm 1.0"], ["en", "Version 1.0"], ["de", "Version 1.0"]] as const) {
  test(`footer shows the release version on every page type: ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    for (const path of ["/login", "/register", "/about", "/"]) {
      await page.goto(path);
      const copyright = page.locator("footer p").first();
      await expect(copyright).toContainText("v1.0");
      await expect(copyright.locator(".sr-only")).toHaveText(", " + label);
    }
  });
}

/** Tab-style focus: move away and back so the browser treats it as keyboard focus (:focus-visible). */
async function focusByKeyboard(page: Page, target: Locator) {
  await target.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
}

async function expectVisibleRing(page: Page) {
  const ring = await page.evaluate(() => {
    const style = getComputedStyle(document.activeElement!);
    return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThan(0);
}

test("every footer link, the header logo and the FAQ and license controls show a focus ring for keyboard users", async ({ page }) => {
  for (const path of ["/login", "/about", "/faq", "/license"]) {
    await page.goto(path);
    const links = page.locator("footer a");
    for (let index = 0; index < await links.count(); index++) {
      await focusByKeyboard(page, links.nth(index));
      await expectVisibleRing(page);
    }
  }
  await page.goto("/about");
  await focusByKeyboard(page, page.locator("header").getByRole("link", { name: "PDA · Project Delivery Assistant" }));
  await expectVisibleRing(page);
  await page.goto("/about");
  await focusByKeyboard(page, page.locator("#team a").first());
  await expectVisibleRing(page);
  await page.goto("/faq");
  await focusByKeyboard(page, page.locator("summary").first());
  await expectVisibleRing(page);
  await page.goto("/license");
  await focusByKeyboard(page, page.locator("pre"));
  await expectVisibleRing(page);
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
  await expect(menu.locator('a[href="/tr/iletisim"]')).toBeVisible();
  await expect(menu.locator('a[href="/tr/kullanim-kosullari"]')).toHaveText("Kullanım Koşulları");
  await expect(menu.locator('a[href="/tr/kvkk"]')).toHaveText("KVKK Aydınlatma Metni");
  await expect(menu.locator('a[href^="mailto:"]')).toHaveCount(0);
  // The cookie policy is listed with the other policies and the preferences can be reopened from the same group.
  await expect(menu.getByRole("menuitem", { name: "Çerez tercihlerini yönet" })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Çerez tercihlerini yönet" }).click();
  await expect(page.getByRole("dialog")).toContainText("Çerez tercihleri");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await menu.locator('a[href="/tr/gizlilik"]').click();
  await expect(page).toHaveURL(/\/tr\/gizlilik$/);
  await expect(page.locator("h1")).toHaveText("Gizlilik Politikası");
});
