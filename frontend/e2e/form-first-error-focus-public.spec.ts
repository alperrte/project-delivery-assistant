import { expect, test, type Page } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";

// When a form is submitted with errors, the keyboard focus has to land on the first invalid field.
// Each case fills the leading fields correctly so the first invalid one is not simply the first input.

const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

const API = "http://localhost:8080/api/v1";

/** Step one of the reset flow is answered by a stub so the code / new password step can be reached without a backend. */
async function stubCodeRequest(page: Page, origin: string) {
  const cors = {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "Content-Type, X-XSRF-TOKEN",
    "access-control-allow-methods": "POST",
  };
  await page.route(`${API}/auth/csrf`, (route) => route.fulfill({
    status: 200, contentType: "application/json", headers: cors,
    body: JSON.stringify({ headerName: "X-XSRF-TOKEN", parameterName: "_csrf", token: "t" }),
  }));
  await page.route(`${API}/auth/password/forgot`, (route) => route.fulfill({ status: 204, headers: cors }));
}

test.describe("İlk hataya yönlendirme: herkese açık formlar", () => {
  test("giriş: boş gönderimde e-posta, e-posta doluyken şifre odaklanır", async ({ page }) => {
    await page.goto(buildPath("/login", {}, "tr"));
    await page.getByRole("button", { name: tr.login.submit, exact: true }).click();
    await expect(page.getByLabel(tr.login.email, { exact: true })).toBeFocused();

    await page.getByLabel(tr.login.email, { exact: true }).fill("kisi@example.test");
    await page.getByRole("button", { name: tr.login.submit, exact: true }).click();
    await expect(alertWith(page, tr.validation.required)).toBeVisible();
    await expect(page.getByLabel(tr.login.password, { exact: true })).toBeFocused();
  });

  test("kayıt: ilk üç alan geçerliyken şifre tekrarı odaklanır", async ({ page }) => {
    await page.goto(buildPath("/register", {}, "tr"));
    await page.getByRole("button", { name: tr.register.submit, exact: true }).click();
    await expect(page.getByLabel(tr.register.email, { exact: true })).toBeFocused();

    await page.getByLabel(tr.register.email, { exact: true }).fill("kisi@example.test");
    await page.getByLabel(tr.register.nickname, { exact: true }).fill("kisi_test");
    await page.getByLabel(tr.register.password, { exact: true }).fill("Parola-12345");
    await page.getByRole("button", { name: tr.register.submit, exact: true }).click();
    await expect(page.getByLabel(tr.register.confirmPassword, { exact: true })).toBeFocused();
  });

  test("şifremi unuttum: geçersiz e-postada alan odaklanır", async ({ page }) => {
    await page.goto(buildPath("/forgot-password", {}, "tr"));
    await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("gecersiz");
    await page.getByRole("button", { name: tr.forgotPassword.sendCode, exact: true }).click();
    await expect(alertWith(page, tr.validation.email)).toBeVisible();
    await expect(page.getByLabel(tr.forgotPassword.email, { exact: true })).toBeFocused();
  });

  test("şifremi unuttum, ikinci adım: kod, yeni şifre ve tekrar sırayla odaklanır", async ({ page }) => {
    await page.goto(buildPath("/forgot-password", {}, "tr"));
    await stubCodeRequest(page, new URL(page.url()).origin);
    await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("kisi@example.test");
    await page.getByRole("button", { name: tr.forgotPassword.sendCode, exact: true }).click();
    await expect(page.getByText(tr.forgotPassword.codeSentTitle)).toBeVisible();

    const submit = page.getByRole("button", { name: tr.forgotPassword.reset, exact: true });
    const code = page.getByLabel(tr.forgotPassword.code, { exact: true });
    const newPassword = page.getByLabel(tr.forgotPassword.newPassword, { exact: true });
    const confirm = page.getByLabel(tr.forgotPassword.confirmPassword, { exact: true });

    await submit.click();
    await expect(alertWith(page, tr.validation.code)).toBeVisible();
    await expect(code).toBeFocused();

    await code.fill("123456");
    await submit.click();
    await expect(alertWith(page, tr.validation.passwordMin)).toBeVisible();
    await expect(newPassword).toBeFocused();

    await newPassword.fill("Parola-12345");
    await confirm.fill("Baska-12345");
    await submit.click();
    await expect(alertWith(page, tr.validation.passwordMatch)).toBeVisible();
    await expect(confirm).toBeFocused();
  });

  test("iletişim: ilk üç alan geçerliyken mesaj alanı odaklanır", async ({ page }) => {
    await page.goto(buildPath("/contact", {}, "tr"));
    await page.getByLabel(tr.contact.form.firstName, { exact: true }).fill("Ayşe");
    await page.getByLabel(tr.contact.form.lastName, { exact: true }).fill("Kaya");
    await page.getByLabel(tr.contact.form.email, { exact: true }).fill("ayse@example.test");
    await page.getByRole("button", { name: tr.contact.form.submit, exact: true }).click();
    await expect(page.getByLabel(tr.contact.form.message, { exact: false })).toBeFocused();
  });
});
