import { expect, test, type Page } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";

// Loading state of the public forms without a backend: the answer is held back for a moment (then 500), and while
// it is pending the submit button must be disabled with a spinner; afterwards the form is usable again, data kept.

const API = "http://localhost:8080/api/v1";
const HOLD_MS = 1500;

async function holdPost(page: Page, path: string) {
  const origin = new URL(page.url()).origin;
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "Content-Type, X-XSRF-TOKEN",
    "access-control-allow-methods": "POST",
  };
  const seen = { count: 0 };
  await page.route(`${API}/auth/csrf`, (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: cors,
    body: JSON.stringify({ headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token: "t" }),
  }));
  await page.route(`${API}${path}`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    seen.count += 1;
    await new Promise((resolve) => setTimeout(resolve, HOLD_MS));
    await route.fulfill({ status: 500, contentType: "application/json", headers: cors, body: JSON.stringify({ code: "INTERNAL_ERROR" }) });
  });
  return seen;
}

// The button text changes while sending, so the submit button is found by type, not by name.
async function expectLoadingThenIdle(page: Page, seen: { count: number }) {
  const submit = page.locator('form button[type="submit"]').first();
  await expect(submit).toBeDisabled();
  await expect(submit.locator("svg.animate-spin")).toBeVisible();
  await expect.poll(() => seen.count).toBe(1);
  await expect(submit).toBeEnabled({ timeout: HOLD_MS * 4 });
  await expect(submit.locator("svg.animate-spin")).toHaveCount(0);
  expect(seen.count).toBe(1);
}

test.describe("Yükleniyor durumu: herkese açık formlar", () => {
  test("giriş", async ({ page }) => {
    await page.goto(buildPath("/login", {}, "tr"));
    const seen = await holdPost(page, "/auth/login");
    await page.getByLabel(tr.login.email, { exact: true }).fill("kisi@example.test");
    await page.getByLabel(tr.login.password, { exact: true }).fill("Parola-12345");
    await page.locator('form button[type="submit"]').first().click();
    await expectLoadingThenIdle(page, seen);
    await expect(page.getByLabel(tr.login.email, { exact: true })).toHaveValue("kisi@example.test");
  });

  test("kayıt", async ({ page }) => {
    await page.goto(buildPath("/register", {}, "tr"));
    const seen = await holdPost(page, "/auth/register");
    await page.getByLabel(tr.register.email, { exact: true }).fill("kisi@example.test");
    await page.getByLabel(tr.register.nickname, { exact: true }).fill("kisi_test");
    await page.getByLabel(tr.register.password, { exact: true }).fill("Parola-12345");
    await page.getByLabel(tr.register.confirmPassword, { exact: true }).fill("Parola-12345");
    await page.locator('form button[type="submit"]').first().click();
    await expectLoadingThenIdle(page, seen);
    await expect(page.getByLabel(tr.register.email, { exact: true })).toHaveValue("kisi@example.test");
  });

  test("şifremi unuttum, kod isteme", async ({ page }) => {
    await page.goto(buildPath("/forgot-password", {}, "tr"));
    const seen = await holdPost(page, "/auth/password/forgot");
    await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("kisi@example.test");
    await page.locator('form button[type="submit"]').first().click();
    await expectLoadingThenIdle(page, seen);
  });

  test("iletişim", async ({ page }) => {
    await page.goto(buildPath("/contact", {}, "tr"));
    const seen = await holdPost(page, "/contact");
    await page.getByLabel(tr.contact.form.firstName, { exact: true }).fill("Ayşe");
    await page.getByLabel(tr.contact.form.lastName, { exact: true }).fill("Kaya");
    await page.getByLabel(tr.contact.form.email, { exact: true }).fill("ayse@example.test");
    await page.getByLabel(tr.contact.form.message, { exact: false }).fill("Merhaba, bu bir deneme mesajıdır.");
    await page.locator('form button[type="submit"]').first().click();
    await expectLoadingThenIdle(page, seen);
    await expect(page.getByLabel(tr.contact.form.firstName, { exact: true })).toHaveValue("Ayşe");
  });
});
