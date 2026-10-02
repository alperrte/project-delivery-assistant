import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { api, login } from "./helpers";
import { MANAGER_STORAGE, MANAGER_USER_FILE } from "./global-setup";

/**
 * Settings: the account, the password, and the interface defaults (language, theme, animations).
 * The defaults are a draft until Kaydet, then they belong to the account and apply at every sign-in. The language and
 * theme switches in the navbar are temporary and only last for the current sign-in.
 *
 * The shared manager account keeps whatever is saved, so every test that saves puts the plain defaults back.
 */
const PLAIN = { locale: "tr", theme: "system", motion: "system", themeTransition: true };

async function restorePlainDefaults(page: Page) {
  const result = await api(page, "PUT", "/users/me/preferences", PLAIN);
  expect(result.status).toBe(200);
}

const group = (page: Page, name: string) => page.getByRole("radiogroup", { name, exact: true });
const saveButton = (page: Page) => page.getByRole("button", { name: "Kaydet", exact: true });

test.describe("with the shared manager's session", () => {
  test.use({ storageState: MANAGER_STORAGE });

  test("the sidebar's Ayarlar link opens the interface settings, not the account", async ({ page }) => {
    await page.goto("/projects");
    await page.getByRole("link", { name: "Ayarlar", exact: true }).click();

    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ayarlar" })).toBeVisible();
    await expect(group(page, "Arayüz dili")).toBeVisible();
    await expect(group(page, "Tema")).toBeVisible();
    await expect(group(page, "Arayüz animasyonları")).toBeVisible();
    // Profile and password moved to the account page in the navbar's account menu.
    const main = page.locator("#main-content");
    await expect(main.getByRole("button", { name: "Şifreyi güncelle" })).toHaveCount(0);
    await expect(main.getByRole("heading", { name: "Profil" })).toHaveCount(0);
  });

  test("choosing changes nothing until Kaydet, and Vazgeç throws the draft away", async ({ page }) => {
    await page.goto("/settings");
    await expect(saveButton(page)).toBeDisabled();
    const before = (await api(page, "GET", "/users/me/preferences")).json;

    await group(page, "Arayüz dili").getByRole("radio", { name: "English" }).click();
    await group(page, "Tema").getByRole("radio", { name: "Koyu" }).click();
    await group(page, "Arayüz animasyonları").getByRole("radio", { name: "Kapalı" }).click();

    // The choices are only a draft: the page itself stays as it was.
    await expect(page.locator("html")).toHaveAttribute("lang", "tr");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveAttribute("data-motion", "system");
    await expect(page.getByText("Kaydedilmemiş değişiklikler var.")).toBeVisible();
    await expect(saveButton(page)).toBeEnabled();
    // Nothing was stored either.
    expect((await api(page, "GET", "/users/me/preferences")).json).toEqual(before);

    await page.getByRole("button", { name: "Vazgeç" }).click();
    await expect(group(page, "Arayüz dili").getByRole("radio", { name: "Türkçe" })).toBeChecked();
    await expect(group(page, "Tema").getByRole("radio", { name: "Sistem" })).toBeChecked();
    await expect(saveButton(page)).toBeDisabled();
  });

  test("Kaydet stores the language on the account, applies it, and it is still there after a reload", async ({ page }) => {
    await page.goto("/settings");
    await group(page, "Arayüz dili").getByRole("radio", { name: "English" }).click();
    await saveButton(page).click();

    await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 15_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    expect(((await api(page, "GET", "/users/me/preferences")).json as { locale: string }).locale).toBe("en");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await restorePlainDefaults(page);
  });

  test("a saved theme applies at once and survives a reload", async ({ page }) => {
    await page.goto("/settings");
    const themes = group(page, "Tema");

    await themes.getByRole("radio", { name: "Koyu" }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await saveButton(page).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
    await page.reload();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(themes.getByRole("radio", { name: "Koyu" })).toBeChecked();

    // An explicit "Açık" stays what it says, even though the device itself is in light mode.
    await themes.getByRole("radio", { name: "Açık", exact: true }).click();
    await saveButton(page).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(themes.getByRole("radio", { name: "Açık", exact: true })).toBeChecked();
    await restorePlainDefaults(page);
  });

  test("the animation choices are saved, applied to the page, and the draft decides whether the theme transition can be set", async ({ page }) => {
    await page.goto("/settings");
    const ui = group(page, "Arayüz animasyonları");
    const theme = group(page, "Tema geçiş animasyonu");

    await expect(page.locator("html")).toHaveAttribute("data-motion", "system");
    await expect(ui.getByRole("radio", { name: "Cihazı izle" })).toBeChecked();
    await expect(theme.getByRole("radio", { name: "Açık" })).toBeEnabled();

    // Off in the draft already blocks the theme transition choice, but the page only changes on Kaydet.
    await ui.getByRole("radio", { name: "Kapalı" }).click();
    await expect(theme.getByRole("radio", { name: "Açık" })).toBeDisabled();
    await expect(page.getByText("Arayüz animasyonları kapalı veya cihazınız hareketi azaltıyor")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "system");
    await saveButton(page).click();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-motion", "off");

    // The device asks for less motion: following it blocks the transition, "Açık" overrides the device.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await ui.getByRole("radio", { name: "Cihazı izle" }).click();
    await expect(theme.getByRole("radio", { name: "Açık" })).toBeDisabled();
    await ui.getByRole("radio", { name: "Açık", exact: true }).click();
    await expect(theme.getByRole("radio", { name: "Açık" })).toBeEnabled();
    await restorePlainDefaults(page);
  });
});

test("saved defaults survive logging out and in; the navbar's changes do not", async ({ browser }) => {
  const manager: { email: string; password: string } = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf-8"));
  // A brand-new browser session of the same account: its own sign-in, so signing out here ends only this one.
  const context = await browser.newContext({ locale: "tr-TR" });
  const page = await context.newPage();
  try {
    await login(page, manager.email, manager.password);
    await page.goto("/settings");

    // Save English and the dark theme as the account's defaults.
    await group(page, "Arayüz dili").getByRole("radio", { name: "English" }).click();
    await group(page, "Tema").getByRole("radio", { name: "Koyu" }).click();
    await saveButton(page).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en", { timeout: 15_000 });
    await expect(page.locator("html")).toHaveClass(/dark/);

    // A temporary change from the navbar: the light theme, only for now.
    await page.mouse.move(700, 8);
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    // The saved default is untouched.
    expect(((await api(page, "GET", "/users/me/preferences")).json as { theme: string }).theme).toBe("dark");

    // Sign out: the temporary light theme is gone, the sign-in screen shows the saved defaults again.
    await page.mouse.move(700, 8);
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    // A new sign-in starts with the saved defaults, not with anything left over. The screen is in English now, so the
    // shared Turkish `login` helper cannot be used here.
    await page.locator('input[name="email"]').fill(manager.email);
    await page.locator('input[name="password"]').fill(manager.password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await page.goto("/settings");
    await expect(group(page, "Interface language").getByRole("radio", { name: "English" })).toBeChecked();
    await expect(group(page, "Theme").getByRole("radio", { name: "Dark" })).toBeChecked();
  } finally {
    await restorePlainDefaults(page).catch(() => undefined);
    await context.close();
  }
});
