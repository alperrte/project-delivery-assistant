import { expect, test, type Browser, type Page } from "@playwright/test";
import { matchPath } from "../src/i18n/routing";
import { REJECTED_STATE } from "./consent-state";
import { api, login, openPasswordChangeForm, registerUser, uniqueUser } from "./helpers";
import { mailsTo, mailpitAvailable, waitForCode } from "./mailpit";
import tr from "../src/i18n/messages/tr.json";

// Mailed 6-digit codes on the real stack (browser -> frontend -> API -> SMTP -> Mailpit): registration, password
// reset and the password change in account settings. Needs the e2e stack: docker-compose.e2e.yml.

test.use({ storageState: REJECTED_STATE });

const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text }).first();
const codeField = (page: Page) => page.getByLabel(tr.codeEntry.label, { exact: true });

async function freshPage(browser: Browser) {
  const context = await browser.newContext({ storageState: REJECTED_STATE });
  return { context, page: await context.newPage() };
}

async function fillRegistration(page: Page, user: { email: string; nickname: string; password: string }) {
  await page.goto("/register");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="nickname"]').fill(user.nickname);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('input[name="confirmPassword"]').fill(user.password);
}

test.beforeAll(async () => {
  expect(await mailpitAvailable(), "Start the e2e stack: docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d").toBe(true);
});

test.describe("Kayıt: e-posta doğrulama", () => {
  test("zayıf parola kabul edilmez, kurallar canlı gösterilir", async ({ page }) => {
    const user = uniqueUser("weak");
    await fillRegistration(page, { ...user, password: "aaaaaaaa" });
    await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
    await expect(alertWith(page, tr.validation.passwordWeak)).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeFocused();
    // No account and no mail came out of it.
    expect(await mailsTo(user.email)).toHaveLength(0);
  });

  test("doğrulanmamış hesap giriş yapamaz; kod tek kullanımlıktır; doğrulayınca giriş açılır", async ({ page, browser }) => {
    const user = uniqueUser("verify");
    await fillRegistration(page, user);
    await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
    await expect(page).toHaveURL((url) => matchPath(url.pathname)?.route === "/verify-email");
    const code = await waitForCode(user.email);

    // Before the code is entered the password alone does not open the account.
    const other = await freshPage(browser);
    await other.page.goto("/login");
    await other.page.locator('input[name="email"]').fill(user.email);
    await other.page.locator('input[name="password"]').fill(user.password);
    await other.page.getByRole("button", { name: /^Giriş yap$/ }).click();
    await expect(alertWith(other.page, tr.errors.emailNotVerified)).toBeVisible();
    await expect(other.page.locator("#main-content")).toHaveCount(0);
    await other.context.close();

    // A wrong code is refused and the right one still works afterwards.
    const wrong = code === "000000" ? "000001" : "000000";
    await codeField(page).fill(wrong);
    await page.getByRole("button", { name: tr.verifyEmail.verify, exact: true }).click();
    await expect(alertWith(page, tr.errors.resetCodeInvalid)).toBeVisible();
    await codeField(page).fill(code);
    await page.getByRole("button", { name: tr.verifyEmail.verify, exact: true }).click();
    // The password typed at registration signs the person in right away: no detour through the login page.
    await expect(page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
    expect(matchPath(new URL(page.url()).pathname)?.route).not.toBe("/login");

    // Single use: the very same code is dead now.
    const replay = await api(page, "POST", "/auth/register/verify", { email: user.email, code });
    expect(replay.status, JSON.stringify(replay.json)).toBeGreaterThanOrEqual(400);
  });

  test("15 dakikalık sayaç dolunca kod alanı kilitlenir ve yeni kod istenebilir", async ({ page }) => {
    await page.clock.install();
    await fillRegistration(page, uniqueUser("timer"));
    await page.getByRole("button", { name: /^Kayıt ol$/ }).click();
    await expect(page).toHaveURL((url) => matchPath(url.pathname)?.route === "/verify-email");
    await expect(page.getByRole("timer")).toContainText("15:00");

    await page.clock.fastForward("15:01");
    await expect(page.getByRole("button", { name: tr.codeEntry.resend, exact: true })).toBeVisible();
    await expect(codeField(page)).toBeDisabled();
  });
});

test.describe("Şifremi unuttum: üç adım", () => {
  test("e-posta → kod → yeni şifre; eski şifre geçmez, kod yeniden kullanılamaz", async ({ page, browser }) => {
    const user = uniqueUser("forgot");
    await registerUser(page, user);
    const newPassword = "Yeni-Parola-123!";

    const flow = await freshPage(browser);
    const mailsBefore = (await mailsTo(user.email)).length;
    await flow.page.goto("/forgot-password");
    await flow.page.getByLabel(tr.forgotPassword.email, { exact: true }).fill(user.email);
    await flow.page.getByRole("button", { name: tr.forgotPassword.sendCode, exact: true }).click();
    const code = await waitForCode(user.email, mailsBefore);

    await codeField(flow.page).fill(code);
    await flow.page.getByRole("button", { name: tr.forgotPassword.verify, exact: true }).click();
    await flow.page.getByLabel(tr.forgotPassword.newPassword, { exact: true }).fill(newPassword);
    await flow.page.getByLabel(tr.forgotPassword.confirmPassword, { exact: true }).fill(newPassword);
    await flow.page.getByRole("button", { name: tr.forgotPassword.reset, exact: true }).click();
    await expect(flow.page).toHaveURL((url) => matchPath(url.pathname)?.route === "/login");

    const replay = await api(flow.page, "POST", "/auth/password/reset/verify", { email: user.email, code });
    expect(replay.status, JSON.stringify(replay.json)).toBeGreaterThanOrEqual(400);

    // The old password is gone, the new one signs in.
    await flow.page.locator('input[name="email"]').fill(user.email);
    await flow.page.locator('input[name="password"]').fill(user.password);
    await flow.page.getByRole("button", { name: /^Giriş yap$/ }).click();
    await expect(flow.page.getByRole("alert").first()).toBeVisible();
    await login(flow.page, user.email, newPassword);
    await flow.context.close();
  });
});

test.describe("Hesap ayarları: şifre değiştirme kapısı", () => {
  test("kod doğrulanmadan şifre değişmez; doğrulayınca eski + yeni şifreyle değişir", async ({ page, browser }) => {
    const user = uniqueUser("gate");
    await registerUser(page, user);
    const newPassword = "Yeni-Parola-123!";

    // The API refuses the change without the mailed code, whatever the form does.
    const direct = await api(page, "POST", "/auth/password/change", {
      currentPassword: user.password, newPassword, confirmNewPassword: newPassword,
    });
    expect(direct.status, JSON.stringify(direct.json)).toBe(403);

    // On the page the form is not even there until the code is entered.
    await page.goto("/account");
    await expect(page.getByLabel(tr.changePassword.currentPassword, { exact: true })).toHaveCount(0);

    await openPasswordChangeForm(page, user.email);
    await page.getByLabel(tr.changePassword.currentPassword, { exact: true }).fill(user.password);
    await page.getByLabel(tr.changePassword.newPassword, { exact: true }).fill(newPassword);
    await page.getByLabel(tr.changePassword.confirmNewPassword, { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: tr.changePassword.submit, exact: true }).click();
    await expect(page.locator('[data-sonner-toast][data-type="success"]').filter({ hasText: tr.changePassword.success })).toBeVisible();

    const fresh = await freshPage(browser);
    await login(fresh.page, user.email, newPassword);
    await fresh.context.close();
  });

  test("mevcut şifremi hatırlamıyorum, şifremi unuttum sayfasına götürür", async ({ page }) => {
    const user = uniqueUser("shortcut");
    await registerUser(page, user);
    await openPasswordChangeForm(page, user.email);
    await page.getByRole("link", { name: tr.securityFlow.password.forgot }).click();
    await expect(page).toHaveURL((url) => matchPath(url.pathname)?.route === "/forgot-password");
  });
});
