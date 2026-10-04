import { test, expect } from "@playwright/test";
import { MEMBER_STORAGE } from "./global-setup";

/**
 * The access token lives 15 minutes. When it expires while the page is open (no reload), the next API call is made
 * without a valid access cookie. The client must notice that the session merely expired, renew it with the refresh
 * cookie and repeat the call; it must never show the user a "you are not allowed" message for it.
 */
test("an expired access token is renewed in place instead of showing a permission error", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const page = await context.newPage();

  const statuses: number[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/v1/projects?")) statuses.push(response.status());
  });

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: /Tekrar hoş geldin/ })).toBeVisible();

  // Simulate the expiry: the browser drops the HttpOnly access cookie, the refresh cookie stays.
  await context.clearCookies({ name: "PDA_ACCESS" });

  // A client-side navigation, so the page is not reloaded (a reload would renew the session through /auth/me).
  await page.getByRole("link", { name: "Projeler", exact: true }).click();

  await expect(page).toHaveURL(/\/tr\/projeler$/);
  await expect(page.getByRole("heading", { level: 1, name: "Projeler" })).toBeVisible();
  await expect(page.getByText("Bu işlem için yetkiniz yok.")).toHaveCount(0);
  // The list call was refused once for lack of a session, then repeated successfully after the renewal.
  expect(statuses.at(-1)).toBe(200);

  await context.close();
});

test("when the session is really over, the user is sent to the login page instead of an error", async ({ browser }) => {
  const context = await browser.newContext({ storageState: MEMBER_STORAGE });
  const page = await context.newPage();

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: /Tekrar hoş geldin/ })).toBeVisible();

  // Both cookies gone (refresh token expired or revoked): there is nothing left to renew.
  await context.clearCookies({ name: "PDA_ACCESS" });
  await context.clearCookies({ name: "PDA_REFRESH" });
  // A background request may notice the ended session before the click lands; either way the user must be sent away.
  await page.getByRole("link", { name: "Projeler", exact: true }).click({ timeout: 3_000 }).catch(() => undefined);

  await expect(page).toHaveURL(/\/tr\/giris/);
  await expect(page.getByText("E-posta veya şifre hatalı.")).toHaveCount(0);
  await expect(page.getByText("Bu işlem için yetkiniz yok.")).toHaveCount(0);

  await context.close();
});
