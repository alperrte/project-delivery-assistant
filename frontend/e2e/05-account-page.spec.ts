import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MANAGER_STORAGE, MANAGER_USER_FILE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

test("sidebar account settings opens the account page instead of redirecting to projects", async ({ page }) => {
  const manager: { nickname: string; email: string } = JSON.parse(readFileSync(MANAGER_USER_FILE, "utf-8"));

  await page.goto("/projects");
  await page.getByRole("link", { name: "Hesap ayarları" }).click();

  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("heading", { level: 1, name: "Hesap ayarları" })).toBeVisible();
  const main = page.locator("#main-content");
  await expect(main.getByText(manager.nickname, { exact: true })).toBeVisible();
  await expect(main.getByText(manager.email, { exact: true })).toBeVisible();
  await expect(main.getByRole("button", { name: "Şifreyi güncelle" })).toBeVisible();
});
