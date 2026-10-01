import { test, expect } from "@playwright/test";
import { MANAGER_STORAGE } from "./global-setup";

test.use({ storageState: MANAGER_STORAGE });

test("sidebar calendar opens its own calendar page instead of the dashboard", async ({ page }) => {
  await page.goto("/projects");
  await page.getByRole("link", { name: "Takvim" }).click();

  await expect(page).toHaveURL(/\/calendar$/);
  await expect(page.getByRole("heading", { level: 1, name: "Takvim" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Tekrar hoş geldin/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Bugün" })).toBeVisible();

  const monthHeading = page.getByRole("heading", { level: 2 }).first();
  const before = await monthHeading.textContent();
  await page.getByRole("button", { name: "Sonraki ay" }).click();
  await expect(monthHeading).not.toHaveText(before ?? "");
  await page.getByRole("button", { name: "Bugün" }).click();
  await expect(monthHeading).toHaveText(before ?? "");
});
