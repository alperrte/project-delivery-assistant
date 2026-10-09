import { test, expect, type Page } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";
import { CONSENT_STORAGE_KEY, CONSENT_VERSION } from "../src/features/consent/contract";
import { FRESH_VISITOR } from "./consent-state";

// A first-time visitor: nothing decided yet.
test.use({ storageState: FRESH_VISITOR });

const banner = (page: Page) => page.locator("[data-cookie-banner]");
const dialog = (page: Page) => page.getByRole("dialog");
const stored = (page: Page) => page.evaluate((key) => localStorage.getItem(key), CONSENT_STORAGE_KEY);
const analyticsKeys = (page: Page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith("pda:analytics")));

test("first visit asks, analytics is off and nothing is stored", async ({ page }) => {
  await page.goto("/login");
  await expect(banner(page)).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Tümünü reddet" })).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Tercihleri yönet" })).toBeVisible();
  await expect(banner(page).getByRole("button", { name: "Tümünü kabul et" })).toBeVisible();
  expect(await stored(page)).toBeNull();
  expect(await analyticsKeys(page)).toEqual([]);

  await banner(page).getByRole("button", { name: "Tercihleri yönet" }).click();
  await expect(dialog(page)).toBeVisible();
  const necessary = dialog(page).getByRole("checkbox", { name: "Zorunlu" });
  const analytics = dialog(page).getByRole("checkbox", { name: "Analitik" });
  await expect(necessary).toBeChecked();
  await expect(necessary).toBeDisabled();
  await expect(analytics).not.toBeChecked();
  await expect(analytics).toBeEnabled();
});

test("reject all is stored, survives a reload and keeps analytics off", async ({ page }) => {
  await page.goto("/login");
  await banner(page).getByRole("button", { name: "Tümünü reddet" }).click();
  await expect(banner(page)).toHaveCount(0);
  const record = JSON.parse((await stored(page))!);
  expect(record).toMatchObject({ version: CONSENT_VERSION, necessary: true, analytics: false });
  await page.reload();
  await expect(page.locator("footer")).toBeVisible();
  await expect(banner(page)).toHaveCount(0);
  expect(JSON.parse((await stored(page))!).analytics).toBe(false);
  expect(await analyticsKeys(page)).toEqual([]);
});

test("accept all is stored and survives a reload", async ({ page }) => {
  await page.goto("/faq");
  await banner(page).getByRole("button", { name: "Tümünü kabul et" }).click();
  await expect(banner(page)).toHaveCount(0);
  expect(JSON.parse((await stored(page))!)).toMatchObject({ version: CONSENT_VERSION, analytics: true });
  await page.reload();
  await expect(banner(page)).toHaveCount(0);
  expect(JSON.parse((await stored(page))!).analytics).toBe(true);
});

test("preferences can be saved with analytics on and later withdrawn from the footer", async ({ page }) => {
  await page.goto("/login");
  await banner(page).getByRole("button", { name: "Tercihleri yönet" }).click();
  await dialog(page).getByRole("checkbox", { name: "Analitik" }).click();
  await dialog(page).getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(banner(page)).toHaveCount(0);
  expect(JSON.parse((await stored(page))!).analytics).toBe(true);

  // Stand-in identifiers: withdrawing must remove whatever the analytics category created.
  await page.evaluate(() => {
    localStorage.setItem("pda:analytics-visitor", "11111111-1111-4111-8111-111111111111");
    localStorage.setItem("pda:analytics-session", "{\"id\":\"22222222-2222-4222-8222-222222222222\",\"lastActive\":1}");
  });
  await page.locator("footer").getByRole("button", { name: "Çerez tercihlerini yönet" }).click();
  const analytics = dialog(page).getByRole("checkbox", { name: "Analitik" });
  await expect(analytics).toBeChecked();
  await analytics.click();
  await dialog(page).getByRole("button", { name: "Tercihleri kaydet" }).click();
  await expect(dialog(page)).toHaveCount(0);
  expect(JSON.parse((await stored(page))!).analytics).toBe(false);
  expect(await analyticsKeys(page)).toEqual([]);
});

test("a decision from an older consent version asks again and stays denied meanwhile", async ({ page }) => {
  await page.addInitScript(([key, version]) => {
    localStorage.setItem(key, JSON.stringify({ version: Number(version) - 1, necessary: true, analytics: true, updatedAt: "2026-01-01T00:00:00.000Z" }));
  }, [CONSENT_STORAGE_KEY, String(CONSENT_VERSION)]);
  await page.goto("/login");
  await expect(banner(page)).toBeVisible();
  await page.evaluate(() => localStorage.setItem("pda:cookie-consent", "not json"));
  await page.reload();
  await expect(banner(page)).toBeVisible();
});

test("keyboard: banner reachable, dialog traps focus, Escape closes without saving", async ({ page }) => {
  await page.goto("/login");
  const manage = banner(page).getByRole("button", { name: "Tercihleri yönet" });
  await manage.focus();
  await page.keyboard.press("Enter");
  await expect(dialog(page)).toBeVisible();
  // Focus stays inside the dialog while tabbing around.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    // The trap hands focus back to the dialog on the next frame, so poll instead of reading once.
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
  expect(await stored(page)).toBeNull();
  await expect(banner(page)).toBeVisible();
});

for (const [locale, policyTitle, manageLabel] of [
  ["tr", "Çerez Politikası", "Çerez tercihlerini yönet"],
  ["en", "Cookie Policy", "Manage cookie preferences"],
  ["de", "Cookie-Richtlinie", "Cookie-Einstellungen verwalten"],
] as const) {
  test(`cookie policy page is real and reopens the preferences: ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: "NEXT_LOCALE", value: locale, url: "http://localhost:3000" }]);
    await page.goto("/cookies");
    await expect(page).toHaveURL(new RegExp(`${buildPath("/cookies", {}, locale)}$`));
    await expect(page.locator("h1")).toHaveText(policyTitle);
    await expect(page.locator("meta[name=\"robots\"]")).toHaveAttribute("content", "noindex, follow");
    // The real inventory is named on the page.
    for (const name of ["PDA_ACCESS", "PDA_REFRESH", "PDA_SESSION", "XSRF-TOKEN", "NEXT_LOCALE", "pda:cookie-consent", "pda:analytics-visitor"]) {
      await expect(page.locator("article")).toContainText(name);
    }
    expect(await page.locator("article section").count()).toBeGreaterThanOrEqual(5);
    // Footer link and the page's own button.
    await expect(page.locator(`footer a[href="${buildPath("/cookies", {}, locale)}"]`)).toBeVisible();
    await page.locator("article").getByRole("button", { name: manageLabel }).click();
    await expect(dialog(page)).toBeVisible();
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`banner and dialog fit ${width}px in both themes`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const theme of ["light", "dark"]) {
      await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
      await page.goto("/register");
      await expect(banner(page)).toBeVisible();
      const box = (await banner(page).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y + box.height).toBeLessThanOrEqual(700);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      for (const button of await banner(page).getByRole("button").all()) {
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(43);
      }
      await banner(page).getByRole("button", { name: "Tercihleri yönet" }).click();
      await expect(dialog(page)).toBeVisible();
      const dialogBox = (await dialog(page).boundingBox())!;
      expect(dialogBox.x).toBeGreaterThanOrEqual(0);
      expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(width);
      await page.keyboard.press("Escape");
    }
  });
}

test("the banner never hides the last control of a page: the content can be scrolled above it", async ({ page }) => {
  for (const [width, height] of [[1280, 720], [390, 700], [320, 640]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/contact");
    await expect(banner(page)).toBeVisible();
    const send = page.getByRole("button", { name: "Gönder" });
    // A person scrolls the button towards the top of the screen, away from the banner at the bottom.
    await send.evaluate((button) => button.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -80));
    await expect.poll(async () => {
      // Whatever sits at the centre of the button must be the button itself, not the banner.
      return send.evaluate((button) => {
        const rect = button.getBoundingClientRect();
        const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return !!top && (top === button || button.contains(top));
      });
    }, { message: `${width}px` }).toBe(true);
  }
});
