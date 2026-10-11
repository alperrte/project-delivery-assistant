import { test, expect, type Page } from "@playwright/test";
import { api } from "./helpers";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

/**
 * The circular theme change, played by the navbar's theme switch. Going to the light theme the circle opens from the
 * centre (`theme-reveal`); going to the dark theme it closes in on the centre (`theme-close-in`). Both classes live on
 * <html> only while the transition runs, so a page-side observer records which ones appeared.
 *
 * Whether it plays follows the animation choices saved in Settings, which the shared manager account keeps: tests that
 * change them put the plain defaults back.
 */
const PLAIN = { locale: "tr", theme: "system", motion: "on", themeTransition: true };

async function watchTransitionClasses(page: Page) {
  await page.evaluate(() => {
    const seen = new Set<string>();
    Object.assign(window, { __themeMotion: seen });
    new MutationObserver(() => {
      for (const name of ["theme-reveal", "theme-close-in"]) {
        if (document.documentElement.classList.contains(name)) seen.add(name);
      }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  });
}

const seenClasses = (page: Page) =>
  page.evaluate(() => [...((window as unknown as { __themeMotion: Set<string> }).__themeMotion ?? [])].sort());

/** The navbar hides itself when idle; moving to the top edge brings it back before the click. */
async function navbarTheme(page: Page, name: "Koyu" | "Açık") {
  await page.mouse.move(700, 8);
  await page.getByRole("button", { name, exact: true }).click();
}

/** Saves animation choices on the Settings page, the way a person would, so they are applied here too. */
async function saveAnimations(page: Page, choices: { ui?: string; theme?: string }) {
  await page.goto("/settings");
  if (choices.ui) await page.getByRole("radiogroup", { name: "Arayüz animasyonları" }).getByRole("radio", { name: choices.ui, exact: true }).click();
  if (choices.theme) await page.getByRole("radiogroup", { name: "Tema geçiş animasyonu" }).getByRole("radio", { name: choices.theme, exact: true }).click();
  await page.getByRole("button", { name: "Kaydet", exact: true }).click();
  await expect(page.getByText("Ayarlar kaydedildi.")).toBeVisible();
}

test("going to the dark theme closes in on the centre, going back to light opens from it", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await watchTransitionClasses(page);

  await navbarTheme(page, "Koyu");
  await expect(page.locator("html")).toHaveClass(/dark/);
  expect(await seenClasses(page)).toEqual(["theme-close-in"]);
  // The transition cleans up after itself.
  await expect(page.locator("html")).not.toHaveClass(/theme-close-in/);

  await page.evaluate(() => (window as unknown as { __themeMotion: Set<string> }).__themeMotion.clear());
  await navbarTheme(page, "Açık");
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  expect(await seenClasses(page)).toEqual(["theme-reveal"]);
  await expect(page.locator("html")).not.toHaveClass(/theme-reveal/);
});

test("with the theme transition saved as off the theme changes straight away", async ({ page }) => {
  try {
    await saveAnimations(page, { theme: "Kapalı" });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await watchTransitionClasses(page);

    await navbarTheme(page, "Koyu");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await navbarTheme(page, "Açık");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    expect(await seenClasses(page)).toEqual([]);
  } finally {
    await api(page, "PUT", "/users/me/preferences", PLAIN);
  }
});

test("device reduced motion always suppresses animations, and explicit off is respected", async ({ page }) => {
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await watchTransitionClasses(page);

    await navbarTheme(page, "Koyu");
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await seenClasses(page)).toEqual([]);

    await saveAnimations(page, { ui: "Kapalı" });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await watchTransitionClasses(page);
    await navbarTheme(page, "Koyu");
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await seenClasses(page)).toEqual([]);

    // Enabling motion still respects the device accessibility preference.
    await saveAnimations(page, { ui: "Açık" });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await watchTransitionClasses(page);
    // Saving also applied the saved (default) theme, so go dark first, then back to light with the device asking less.
    await navbarTheme(page, "Koyu");
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).not.toHaveClass(/theme-close-in/);
    await page.evaluate(() => (window as unknown as { __themeMotion: Set<string> }).__themeMotion.clear());
    await navbarTheme(page, "Açık");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    expect(await seenClasses(page)).toEqual([]);
  } finally {
    await api(page, "PUT", "/users/me/preferences", PLAIN);
  }
});
