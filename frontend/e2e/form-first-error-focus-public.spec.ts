import { expect, test, type Page } from "@playwright/test";
import { buildPath } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";

// When a form is submitted with errors, the keyboard focus has to land on the first invalid field.
// Each case fills the leading fields correctly so the first invalid one is not simply the first input.

const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text });

const API = "http://localhost:8080/api/v1";

/** The first two steps of the reset flow are answered by stubs so the new-password step can be reached without a backend. */
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
  await page.route(`${API}/auth/password/reset/verify`, (route) => route.fulfill({ status: 204, headers: cors }));
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

  test("şifremi unuttum: kod adımında, sonra yeni şifre adımında hata alanı odaklanır", async ({ page }) => {
    await page.goto(buildPath("/forgot-password", {}, "tr"));
    await stubCodeRequest(page, new URL(page.url()).origin);
    await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("kisi@example.test");
    await page.getByRole("button", { name: tr.forgotPassword.sendCode, exact: true }).click();
    await expect(page.getByText(tr.forgotPassword.codeSentTitle)).toBeVisible();

    const verify = page.getByRole("button", { name: tr.forgotPassword.verify, exact: true });
    const code = page.getByLabel(tr.codeEntry.label, { exact: true });
    await verify.click();
    await expect(alertWith(page, tr.validation.code)).toBeVisible();
    await expect(code).toBeFocused();

    // The right code opens the last step: new password and its repetition.
    await code.fill("123456");
    await verify.click();
    const submit = page.getByRole("button", { name: tr.forgotPassword.reset, exact: true });
    const newPassword = page.getByLabel(tr.forgotPassword.newPassword, { exact: true });
    const confirm = page.getByLabel(tr.forgotPassword.confirmPassword, { exact: true });
    await expect(newPassword).toBeVisible();

    await submit.click();
    await expect(alertWith(page, tr.validation.required).first()).toBeVisible();
    await expect(newPassword).toBeFocused();

    await newPassword.fill("zayifparola");
    await submit.click();
    await expect(alertWith(page, tr.validation.passwordWeak)).toBeVisible();
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

test("verification allows the full server lifetime and resending restores field focus", async ({ page }) => {
  await page.clock.install();
  await page.goto(buildPath("/forgot-password", {}, "tr"));
  await stubCodeRequest(page, new URL(page.url()).origin);
  await page.getByLabel(tr.forgotPassword.email, { exact: true }).fill("timing@example.test");
  await page.getByRole("button", { name: tr.forgotPassword.sendCode, exact: true }).click();
  const code = page.getByLabel(tr.codeEntry.label, { exact: true });
  await expect(page.getByRole("timer")).toContainText("15:00");
  await code.fill("123456");
  await page.clock.fastForward("03:01");
  await expect(code).toBeEnabled();
  await expect(code).toHaveValue("123456");
  await page.clock.fastForward("12:00");
  await expect(code).toBeDisabled();
  await page.getByRole("button", { name: tr.codeEntry.resend, exact: true }).click();
  await expect(code).toBeEnabled();
  await expect(code).toBeFocused();
  await expect(code).toHaveValue("");
  await expect(page.getByRole("timer")).toContainText("15:00");
});
