import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MANAGER_STORAGE, MANAGER_USER_FILE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

/** Account settings: who the person is and their password. It lives in the navbar's account menu, apart from Settings. */
test("the navbar's account menu opens Hesap ayarları with the account details and the password start button", async ({ page }) => {
  const manager: { nickname: string; email: string } = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf-8"));

  await page.goto("/dashboard");
  // The navbar hides itself when idle; moving to the top edge brings it back.
  await page.mouse.move(700, 8);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await page.getByRole("menuitem", { name: "Hesap ayarları" }).click();

  await expect(page).toHaveURL(/\/tr\/hesap$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hesap ayarları" })).toBeVisible();
  const main = page.locator("#main-content");
  await expect(main.getByRole("textbox", { name: "Kullanıcı adı", exact: true })).toHaveValue(manager.nickname);
  await expect(main.getByText(manager.email, { exact: true })).toBeVisible();
  // The password form is closed until a code mailed to the account is entered: only the start button shows.
  await expect(main.getByRole("button", { name: "Şifreyi değiştir", exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Şifreyi güncelle" })).toHaveCount(0);
  // The interface choices are not here: they are on Settings.
  await expect(page.getByRole("radiogroup")).toHaveCount(0);
});

test("the account menu has no 'Ayarlar' entry any more, and the sidebar's Ayarlar is the interface settings", async ({ page }) => {
  await page.goto("/dashboard");
  await page.mouse.move(700, 8);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await expect(page.getByRole("menuitem", { name: "Hesap ayarları" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Ayarlar", exact: true })).toHaveCount(0);
});

test("the navbar shows a typical nickname in full instead of cutting it", async ({ page }) => {
  for (const width of [1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 400 });
    await page.goto("/dashboard");
    const name = page.locator("header span.truncate").first();
    await expect(name).toBeVisible();
    // The shared test account has a long generated name; a typical 12-character one is what must fit.
    await name.evaluate((el) => { el.textContent = "Hamza_Taşbay"; });
    const cut = await name.evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    expect(cut, `cut at ${width}px`).toBe(false);
  }
});
