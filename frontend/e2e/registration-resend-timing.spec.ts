import { expect, test, type Page } from "@playwright/test";
import { REJECTED_STATE } from "./consent-state";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import { buildPath } from "../src/i18n/routing";

test.use({ storageState: REJECTED_STATE });

// UI clock/failure probes only: API responses are explicitly stubbed. The matching backend integration tests
// exercise the real PostgreSQL cooldown, replacement code, fixed expiry and pending-account cleanup.
async function openPending(page: Page, locale: "tr" | "en" | "de" = "tr") {
  const start = new Date("2026-10-11T12:00:00Z");
  await page.clock.install({ time: start });
  await page.clock.pauseAt(start);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("pda.pendingVerification")) {
      sessionStorage.setItem("pda.pendingVerification", JSON.stringify({
        email: "timer@example.test", sendOnOpen: false, issuedAt: Date.now(), lastSentAt: Date.now(),
      }));
    }
  });
  await page.route("**/api/v1/auth/csrf", route => route.fulfill({ json: { headerName: "X-XSRF-TOKEN" } }));
  await page.goto(buildPath("/verify-email", {}, locale));
  await expect(page.getByLabel({ tr, en, de }[locale].codeEntry.label, { exact: true })).toBeVisible();
}

const resendButton = (page: Page) => page.getByRole("button", { name: tr.codeEntry.resend, exact: true });

test("3-minute boundary enables resend while the code remains usable", async ({ page }) => {
  await openPending(page);
  await expect(page.getByRole("timer").last()).toContainText("3:00");
  await page.clock.fastForward(179_000);
  await expect(resendButton(page)).toBeDisabled();
  await page.clock.fastForward(1_000);
  await expect(resendButton(page)).toBeEnabled();
  await expect(page.getByLabel(tr.codeEntry.label, { exact: true })).toBeEnabled();
  await expect(page.getByRole("timer").first()).toContainText("12:00");
});

test("resend resets only its cooldown and survives a page reload", async ({ page }) => {
  let sends = 0;
  await page.route("**/api/v1/auth/register/resend", route => {
    sends++;
    return route.fulfill({ status: 202 });
  });
  await openPending(page);
  await page.clock.fastForward(180_000);
  await page.getByLabel(tr.codeEntry.label, { exact: true }).fill("123456");
  await resendButton(page).click();
  await expect(resendButton(page)).toBeDisabled();
  await expect(page.getByRole("timer").first()).toContainText("12:00");
  await expect(page.getByRole("timer").last()).toContainText("3:00");
  await expect(page.getByLabel(tr.codeEntry.label, { exact: true })).toHaveValue("");
  await expect(page.getByLabel(tr.codeEntry.label, { exact: true })).toBeFocused();
  expect(sends).toBe(1);
  await page.clock.fastForward(60_000);
  await page.reload();
  await expect(page.getByRole("timer").first()).toContainText("11:00");
  await expect(page.getByRole("timer").last()).toContainText("2:00");
  await page.clock.fastForward(660_000);
  await expect(page.getByLabel(tr.codeEntry.label, { exact: true })).toBeDisabled();
  await expect(resendButton(page)).toHaveCount(0);
  await expect(page.getByText(tr.codeEntry.registrationExpired, { exact: true })).toBeVisible();
  await page.getByRole("link", { name: tr.verifyEmail.restartRegistration }).click();
  await expect(page.locator('input[name="nickname"]')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("pda.pendingVerification"))).toBeNull();
});

test("failed resend keeps the typed code and original clocks", async ({ page }) => {
  await page.route("**/api/v1/auth/register/resend", route => route.fulfill({ status: 503 }));
  await openPending(page);
  await page.clock.fastForward(180_000);
  await page.getByLabel(tr.codeEntry.label, { exact: true }).fill("123456");
  await resendButton(page).click();
  await expect(page.getByRole("alert").first()).toBeVisible();
  await expect(resendButton(page)).toBeEnabled();
  await expect(page.getByLabel(tr.codeEntry.label, { exact: true })).toHaveValue("123456");
  await expect(page.getByRole("timer").first()).toContainText("12:00");
});

test("password reset keeps its existing 15-minute countdown and renewal", async ({ page }) => {
  await page.clock.install();
  await page.route("**/api/v1/auth/csrf", route => route.fulfill({ json: { headerName: "X-XSRF-TOKEN" } }));
  await page.route("**/api/v1/auth/password/forgot", route => route.fulfill({ status: 202 }));
  await page.goto("/forgot-password");
  await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("timer@example.test");
  await page.getByRole("button", { name: tr.forgotPassword.sendCode, exact: true }).click();
  await expect(page.getByRole("timer")).toContainText("15:00");
  await expect(resendButton(page)).toHaveCount(0);
  await page.clock.fastForward(901_000);
  await expect(resendButton(page)).toBeVisible();
  await resendButton(page).click();
  await expect(page.getByRole("timer")).toContainText("15:00");
  await expect(page.getByLabel(tr.codeEntry.label, { exact: true })).toBeEnabled();
});

for (const locale of ["tr", "en", "de"] as const) {
  test(`${locale}: mobile countdown and expired registration fit the viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openPending(page, locale);
    const messages = { tr, en, de }[locale];
    await expect(page.getByRole("button", { name: messages.codeEntry.resend, exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${locale}-countdown-mobile.png`), fullPage: true, animations: "disabled" });
    await page.clock.fastForward(900_000);
    await expect(page.getByRole("link", { name: messages.verifyEmail.restartRegistration })).toBeVisible();
    await expect(page.getByLabel(messages.codeEntry.label, { exact: true })).toBeDisabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${locale}-expired-mobile.png`), fullPage: true, animations: "disabled" });
  });
}
