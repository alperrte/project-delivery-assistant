import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DEFAULT_THEME_COLORS } from "../src/features/settings/theme-colors";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

async function fixture(page: Page, locale = "tr", dark = false) {
  const origin = new URL(process.env.E2E_BASE_URL ?? "http://localhost:3000").origin;
  await page.context().addCookies([{ name: "PDA_SESSION", value: "theme-fixture", url: origin }, { name: "XSRF-TOKEN", value: "theme-fixture", url: origin }]);
  let preferences = { locale, theme: dark ? "dark" : "light", motion: "on", themeTransition: false, languageTransition: false,
    navbarMode: "always-visible", themeColors: { ...DEFAULT_THEME_COLORS } };
  let failSave = false, failReset = false, failRead = false;
  await page.routeWebSocket(/\/api\/v1\/ws$/, socket => socket.onMessage(message => {
    if (String(message).startsWith("CONNECT")) socket.send("CONNECTED\nversion:1.2\nheart-beat:0,0\n\n\0");
  }));
  await page.route("**/api/v1/**", async route => {
    const req = route.request(), url = new URL(req.url());
    let status = 200;
    let body: unknown = { content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 };
    if (url.pathname.endsWith("/auth/me")) body = { id: "theme-fixture", nickname: "ThemeFixture", email: "theme@example.test", globalRole: "USER", mustChangePassword: false };
    if (url.pathname.endsWith("/auth/csrf")) body = { headerName: "X-XSRF-TOKEN" };
    if (url.pathname.endsWith("/chat/conversations")) body = { group: null, groups: [], directs: [], totalUnread: 0 };
    if (url.pathname.endsWith("/chat/members")) body = [];
    if (url.pathname.endsWith("/notifications/unread-count")) body = { count: 0 };
    if (req.method() === "OPTIONS" || url.pathname.endsWith("/notifications/team-deletions/claim")) status = 204;
    if (url.pathname.endsWith("/users/me/preferences")) {
      if (req.method() === "GET" && failRead) status = 503;
      if (req.method() === "PUT") {
        if (failSave) { status = 503; failSave = false; }
        else preferences = req.postDataJSON();
      }
      body = preferences;
    }
    if (url.pathname.endsWith("/preferences/theme")) {
      if (failReset) { status = 503; failReset = false; }
      else preferences = { ...preferences, themeColors: { ...DEFAULT_THEME_COLORS } };
      body = preferences;
    }
    await route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true", "access-control-allow-headers": "content-type,x-xsrf-token",
      "access-control-allow-methods": "GET,PUT,POST,DELETE,OPTIONS" }, body: status === 204 ? "" : JSON.stringify(body) });
  });
  return { saved: () => preferences, failSave: () => { failSave = true; }, failReset: () => { failReset = true; },
    failRead: (value: boolean) => { failRead = value; },
    changeSavedColor: (color: string) => { preferences = { ...preferences, themeColors: { ...preferences.themeColors, solidColor: color } }; } };
}

test("returning to a stale tab reloads account colors without replacing an unsaved local draft", async ({ page }) => {
  const api = await fixture(page);
  await page.clock.install();
  await page.goto("/tr/ayarlar");
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#1B5FE0");
  await page.getByLabel("Tema rengi", { exact: true }).fill("#ABCDEF");
  api.changeSavedColor("#C8323A");
  await page.clock.fastForward(31_000);
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--user-light-primary"))).toBe("#C8323A");
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#ABCDEF");
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#C8323A");
});

test("failed initial load offers retry without rendering writable fallback preferences", async ({ page }) => {
  const api = await fixture(page);
  api.failRead(true);
  await page.goto("/tr/ayarlar");
  await expect(page.getByText(tr.preferences.colors.loadError, { exact: true })).toBeVisible();
  await expect(page.locator("[data-theme-color-editor]")).toHaveCount(0);
  api.failRead(false);
  await page.getByRole("button", { name: tr.preferences.colors.retry, exact: true }).click();
  await expect(page.locator("[data-theme-color-editor]")).toBeVisible();
});

test("System preview follows the device before save and applied colors follow subsequent device changes", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await fixture(page); // Stored light appearance overrides the device until Save.
  await page.goto("/tr/ayarlar");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("radiogroup", { name: "Tema", exact: true }).getByRole("radio", { name: "Sistem", exact: true }).click();
  await expect(page.locator("[data-theme-preview]")).toHaveAttribute("data-preview-dark", "true");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByLabel("Tema rengi", { exact: true }).fill("#ffffff");
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  const darkPrimary = await page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--primary"));
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  const lightPrimary = await page.locator("html").evaluate(el => getComputedStyle(el).getPropertyValue("--primary"));
  expect(lightPrimary).not.toBe(darkPrimary);
  await expect(page.locator("[data-theme-preview]")).toHaveAttribute("data-preview-dark", "false");
});

test("Solid and Gradient drafts preview, validate, save, reload, discard and reset without losing other choices", async ({ page }) => {
  const api = await fixture(page);
  await page.goto("/tr/ayarlar");
  const root = page.locator("html"), editor = page.locator("[data-theme-color-editor]");
  const save = page.getByRole("button", { name: "Kaydet", exact: true });
  await expect(editor).toBeVisible();
  await page.getByLabel("Tema rengi", { exact: true }).fill("#abc");
  expect(api.saved().themeColors.solidColor).toBe("#1B5FE0");
  await expect(root).toHaveAttribute("data-user-theme", "solid");
  await save.click();
  expect(api.saved().themeColors.solidColor).toBe("#AABBCC");
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#AABBCC");
  await page.getByRole("radiogroup", { name: "Tema türü" }).getByRole("radio", { name: "Gradyan", exact: true }).click();
  await page.getByLabel("Birinci renk", { exact: true }).fill("#102030");
  await page.getByLabel("İkinci renk", { exact: true }).fill("#ffeedd");
  await page.getByLabel("Gradyan açısı (°)", { exact: true }).fill("360");
  await expect(page.locator("[data-theme-preview] > div").first()).toHaveCSS("background-image", /360deg/);
  await expect(root).toHaveAttribute("data-user-theme", "solid");
  await page.getByLabel("İkinci renk", { exact: true }).fill("bad-color");
  await expect(save).toBeDisabled();
  await expect(page.getByText(tr.preferences.colors.invalidHex, { exact: true })).toBeVisible();
  await page.getByLabel("İkinci renk", { exact: true }).fill("#ffeedd");
  await page.getByLabel("Gradyan açısı (°)", { exact: true }).fill("361");
  await expect(save).toBeDisabled();
  await page.getByRole("button", { name: "Yatay", exact: true }).click();
  await save.click();
  await expect(root).toHaveAttribute("data-user-theme", "gradient");
  expect(api.saved().themeColors.gradientAngle).toBe(90);
  await page.getByLabel("Birinci renk", { exact: true }).fill("#000000");
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(page.getByLabel("Birinci renk", { exact: true })).toHaveValue("#102030");
  await page.getByRole("radiogroup", { name: "Arayüz animasyonları", exact: true }).getByRole("radio", { name: "Kapalı", exact: true }).click();
  await page.getByRole("button", { name: tr.preferences.colors.reset, exact: true }).click();
  await expect(root).toHaveAttribute("data-user-theme", "solid");
  expect(api.saved().themeColors).toEqual(DEFAULT_THEME_COLORS);
  expect(api.saved().motion).toBe("on");
  await expect(save).toBeEnabled(); // Unsaved motion choice survived the color reset.
  await page.getByRole("button", { name: "Vazgeç", exact: true }).click();
  await expect(save).toBeDisabled();
});

test("failed saves and resets preserve the draft and the last applied colors", async ({ page }) => {
  const api = await fixture(page);
  await page.goto("/tr/ayarlar");
  await page.getByLabel("Tema rengi", { exact: true }).fill("#C8323A");
  api.failSave();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#C8323A");
  await expect(page.getByRole("button", { name: "Kaydet", exact: true })).toBeEnabled();
  expect(api.saved().themeColors.solidColor).toBe(DEFAULT_THEME_COLORS.solidColor);
  api.failReset();
  await page.getByRole("button", { name: tr.preferences.colors.reset, exact: true }).click();
  await expect(page.getByRole("button", { name: tr.preferences.colors.reset, exact: true })).toBeEnabled();
  await expect(page.getByLabel("Tema rengi", { exact: true })).toHaveValue("#C8323A");
});

for (const [locale, messages, route] of [["tr", tr, "/tr/ayarlar"], ["en", en, "/en/settings"], ["de", de, "/de/einstellungen"]] as const) {
  for (const dark of [false, true]) test(`${locale} ${dark ? "dark" : "light"}: responsive, keyboard, reduced motion and scoped accessibility`, async ({ page }) => {
    await fixture(page, locale, dark);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(route);
    const t = messages.preferences.colors;
    await expect(page.getByLabel(t.solidColor, { exact: true })).toBeVisible();
    await page.getByLabel(t.solidColor, { exact: true }).focus();
    await expect(page.getByLabel(t.solidColor, { exact: true })).toBeFocused();
    await page.getByRole("radiogroup", { name: t.type }).getByRole("radio", { name: t.gradient, exact: true }).click();
    await page.getByLabel(t.angleSlider, { exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByLabel(t.angle, { exact: true })).toHaveValue("136");
    const folder = path.resolve("../.local/theme-phase1-frontend/captures");
    mkdirSync(folder, { recursive: true });
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 950 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByLabel(t.start, { exact: true })).toBeVisible();
      if (process.env.THEME_CAPTURE !== "0" && (width === 1440 || width === 320)) await page.locator("[data-theme-color-editor]").screenshot({ path: path.join(folder, `${locale}-${dark ? "dark" : "light"}-${width}.png`) });
    }
    const audit = await new AxeBuilder({ page }).include("[data-theme-color-editor]").withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(audit.violations).toEqual([]);
  });
}
