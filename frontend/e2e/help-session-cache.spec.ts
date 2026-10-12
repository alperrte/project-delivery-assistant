import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MANAGER_USER_FILE } from "./global-setup";
import { api } from "./helpers";

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
