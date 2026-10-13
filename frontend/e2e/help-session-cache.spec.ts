import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MANAGER_USER_FILE } from "./global-setup";
import { api, registerUser, revealWorkspaceHeader, uniqueUser } from "./helpers";
import { REJECTED_STATE } from "./consent-state";
import { buildPath, matchPath } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";

test("visitor help cached before login must not return after sign-in and browser back", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const user = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf8"));
  await page.goto("/faq");
  await expect(page.locator("#public-main")).toBeVisible();
  await page.locator("header").getByRole("link", { name: "İletişim", exact: true }).click();
  await expect(page.locator("#public-main [data-contact-page]")).toBeVisible();
  await page.locator("header").getByRole("link", { name: "Giriş yap", exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/giris$/);
  await page.waitForLoadState("networkidle");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.getByRole("button", { name: "Giriş yap", exact: true }).click();
  await expect(page.locator(".app-shell")).toBeVisible();
  const logoutRequests: string[] = [];
  page.on("request", request => { if (request.url().endsWith("/auth/logout")) logoutRequests.push(request.url()); });
  await page.goBack();
  // Only the backend decides whether the session actually ended.
  expect((await api(page, "GET", "/auth/me")).status).toBe(200);
  await expect(page.locator(".app-shell [data-contact-page]")).toBeVisible();
  await expect(page.locator("#public-main")).toHaveCount(0);
  expect(logoutRequests).toEqual([]);
});

for (const [locale, messages] of [["tr", tr], ["en", en], ["de", de]] as const) {
  test(`${locale}: cached visitor FAQ becomes workspace FAQ after login; logout protects cached account history`, async ({ page, context, browser, baseURL }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const user = uniqueUser(`faq${locale}`);
    // Prepare a real verified account outside the anonymous history under test.
    // Its saved language matches this scenario, independent of shared-user settings.
    const preparation = await browser.newContext({ baseURL, locale: "tr-TR", storageState: REJECTED_STATE });
    try {
      const accountPage = await preparation.newPage();
      await registerUser(accountPage, user);
      expect((await api(accountPage, "PUT", "/users/me/preferences", {
        locale, theme: "system", motion: "off", themeTransition: false, languageTransition: false,
      })).status).toBe(200);
      const saved = await api(accountPage, "GET", "/users/me/preferences");
      expect(saved.status).toBe(200);
      expect((saved.json as { locale: string }).locale).toBe(locale);
    } finally { await preparation.close(); }
    await page.goto(buildPath("/faq", {}, locale));
    await expect(page.locator("#public-main article summary").first()).toHaveText(messages.publicPages.faq.groups[0].questions[0].question);
    await page.locator("header").getByRole("link", { name: messages.login.submit, exact: true }).click();
    await expect(page).toHaveURL(url => url.pathname === buildPath("/login", {}, locale));
    await page.waitForLoadState("networkidle");
    await page.locator('input[name="email"]').fill(user.email);
    await page.locator('input[name="password"]').fill(user.password);
    await page.getByRole("button", { name: messages.login.submit, exact: true }).click();
    await expect(page.locator(".app-shell")).toBeVisible();
    await page.goBack();
    expect((await api(page, "GET", "/auth/me")).status).toBe(200);
    await expect(page.locator(".app-shell [data-workspace-faq]")).toBeVisible();
    await expect(page.locator("#public-main")).toHaveCount(0);
    await expect(page.locator("[data-workspace-faq] summary").first()).toHaveText(messages.publicPages.faq.groups[0].questions[0].question);

    // Visit account settings through the real menu, then add another entry so
    // Back after logout attempts to restore an authenticated account page.
    const openMenu = async () => {
      await revealWorkspaceHeader(page);
      await page.getByRole("button", { name: messages.workspace.account, exact: false }).click();
    };
    await openMenu();
    await page.getByRole("menuitem", { name: messages.workspace.accountSettings, exact: true }).click();
    await expect(page).toHaveURL(url => matchPath(url.pathname)?.route === "/account");
    await expect(page.locator(".app-shell #main-content")).toBeVisible();
    await openMenu();
    await page.getByRole("menuitem", { name: messages.siteFooter.faq, exact: true }).click();
    await expect(page.locator(".app-shell [data-workspace-faq]")).toBeVisible();
    const logoutResponse = page.waitForResponse(response => response.url().endsWith("/auth/logout") && response.request().method() === "POST");
    await openMenu();
    await page.getByRole("menuitem", { name: messages.app.nav.logout, exact: true }).click();
    expect((await logoutResponse).status()).toBe(200);
    await expect(page).toHaveURL(url => matchPath(url.pathname)?.route === "/login");
    expect((await context.cookies()).filter(cookie => ["PDA_ACCESS", "PDA_REFRESH", "PDA_SESSION"].includes(cookie.name))).toHaveLength(0);
    expect((await api(page, "GET", "/auth/me")).status).toBe(401);
    await page.goBack();
    await expect(page).toHaveURL(url => matchPath(url.pathname)?.route === "/login" && url.searchParams.has("next"));
    await expect(page.locator(".app-shell")).toHaveCount(0);
    await expect(page.locator("[data-workspace-faq]")).toHaveCount(0);
    expect((await api(page, "GET", "/auth/me")).status).toBe(401);
  });
}
