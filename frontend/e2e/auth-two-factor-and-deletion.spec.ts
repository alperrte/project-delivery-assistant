import { expect, test, type Browser, type Page } from "@playwright/test";
import { matchPath } from "../src/i18n/routing";
import { REJECTED_STATE } from "./consent-state";
import { api, login, registerUser, uniqueUser } from "./helpers";
import { mailpitAvailable, mailsTo } from "./mailpit";
import { totpCode } from "./totp";
import tr from "../src/i18n/messages/tr.json";

// Two-step verification (authenticator app) and account deletion on the real stack. The authenticator is played by
// e2e/totp.ts: the same RFC 6238 maths a phone app does, fed with the key the setup screen shows.

test.use({ storageState: REJECTED_STATE });

const tf = tr.securityFlow.twoFactor;
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text }).first();

async function freshPage(browser: Browser) {
  const context = await browser.newContext({ storageState: REJECTED_STATE });
  return { context, page: await context.newPage() };
}

/** Account settings → turn two-step verification on. Returns the manual key and the ten backup codes. */
async function enableTwoFactor(page: Page) {
  await page.goto("/account");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: tf.enable, exact: true }).click();
  const secret = (await page.locator("code").first().innerText()).trim();
  await page.getByLabel(tf.code, { exact: true }).fill(totpCode(secret));
  await page.getByRole("button", { name: tf.confirm, exact: true }).click();
  await expect(page.getByText(tf.codesTitle)).toBeVisible();
  const backupCodes = (await page.locator("li").allInnerTexts()).map((code) => code.trim()).filter((code) => /^[a-z0-9-]{8,}$/i.test(code));
  expect(backupCodes).toHaveLength(10);
  await page.getByRole("button", { name: tf.codesSaved, exact: true }).click();
  return { secret, backupCodes };
}

/** Email + password on the login page, in a browser that has never been signed in. */
async function submitCredentials(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^Giriş yap$/ }).click();
}

test.beforeAll(async () => {
  expect(await mailpitAvailable(), "Start the e2e stack: docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d").toBe(true);
});

test.describe("İki adımlı doğrulama (Authenticator)", () => {
  test("açınca giriş kod ister: yanlış kod olmaz, doğru kod ve yedek kod (bir kez) girer, kapatınca kod istenmez", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const user = uniqueUser("totp");
    await registerUser(page, user);
    const { secret, backupCodes } = await enableTwoFactor(page);
    await expect(page.getByText(tf.on, { exact: true })).toBeVisible();

    // The password alone no longer opens the account: the second step comes first.
    const other = await freshPage(browser);
    await submitCredentials(other.page, user.email, user.password);
    const codeInput = other.page.getByLabel(tr.login.twoFactorCode, { exact: true });
    await expect(codeInput).toBeVisible();
    await expect(other.page.locator("#main-content")).toHaveCount(0);

    // A wrong code is refused.
    await codeInput.fill("000000");
    await other.page.getByRole("button", { name: tr.login.twoFactorSubmit, exact: true }).click();
    await expect(alertWith(other.page, tr.errors.twoFactorCodeInvalid)).toBeVisible();

    // The right code from the authenticator signs in. (The next step of the clock: enabling used this one.)
    await codeInput.fill(totpCode(secret, 1));
    await other.page.getByRole("button", { name: tr.login.twoFactorSubmit, exact: true }).click();
    await expect(other.page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
    await other.context.close();

    // A backup code signs in once and is dead afterwards.
    const viaBackup = await freshPage(browser);
    await submitCredentials(viaBackup.page, user.email, user.password);
    await viaBackup.page.getByRole("button", { name: tr.login.useBackupCode, exact: true }).click();
    await viaBackup.page.getByLabel(tr.login.backupCode, { exact: true }).fill(backupCodes[0]);
    await viaBackup.page.getByRole("button", { name: tr.login.twoFactorSubmit, exact: true }).click();
    await expect(viaBackup.page.locator("#main-content")).toBeVisible({ timeout: 15_000 });
    await viaBackup.context.close();

    const reuse = await freshPage(browser);
    await submitCredentials(reuse.page, user.email, user.password);
    await reuse.page.getByRole("button", { name: tr.login.useBackupCode, exact: true }).click();
    await reuse.page.getByLabel(tr.login.backupCode, { exact: true }).fill(backupCodes[0]);
    await reuse.page.getByRole("button", { name: tr.login.twoFactorSubmit, exact: true }).click();
    await expect(alertWith(reuse.page, tr.errors.twoFactorCodeInvalid)).toBeVisible();
    await expect(reuse.page.locator("#main-content")).toHaveCount(0);
    await reuse.context.close();

    // Turning it off needs the password and a code (a second backup code here); afterwards the login is one step.
    await page.goto("/account");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: tf.disable, exact: true }).click();
    await page.getByLabel(tf.password, { exact: true }).fill(user.password);
    await page.getByLabel(tf.code, { exact: true }).fill(backupCodes[1]);
    await page.getByRole("button", { name: tf.disableConfirm, exact: true }).click();
    await expect(page.getByRole("button", { name: tf.enable, exact: true })).toBeVisible();

    const plain = await freshPage(browser);
    await login(plain.page, user.email, user.password);
    await plain.context.close();
  });

  test("kapatmak için yanlış şifre kabul edilmez; durum açık kalır", async ({ page }) => {
    const user = uniqueUser("totpoff");
    await registerUser(page, user);
    const { secret } = await enableTwoFactor(page);

    await page.getByRole("button", { name: tf.disable, exact: true }).click();
    await page.getByLabel(tf.password, { exact: true }).fill("Yanlis-Parola-1!");
    await page.getByLabel(tf.code, { exact: true }).fill(totpCode(secret, 1));
    await page.getByRole("button", { name: tf.disableConfirm, exact: true }).click();
    await expect(page.getByRole("alert").first()).toBeVisible();

    const status = await api(page, "GET", "/auth/2fa");
    expect(status.status).toBe(200);
    expect((status.json as { enabled: boolean }).enabled).toBe(true);
  });
});

test.describe("Hesabı silme", () => {
  test("hesap ayarlarından istenir → mailde bağlantı → sayfada e-posta + şifre → hesap silinir, bağlantı tek kullanımlık", async ({ page, browser }) => {
    test.setTimeout(120_000);
    const user = uniqueUser("delete");
    await registerUser(page, user);
    const mailsBefore = (await mailsTo(user.email)).length;

    await page.goto("/account");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: tr.securityFlow.deleteAccount.button, exact: true }).click();
    await page.getByRole("button", { name: tr.securityFlow.deleteAccount.confirm, exact: true }).click();
    await expect(page.getByText(tr.securityFlow.deleteAccount.sentTitle)).toBeVisible();

    // The mail carries the link; only its page can finish the deletion.
    await expect.poll(async () => (await mailsTo(user.email)).length, { timeout: 20_000 }).toBeGreaterThan(mailsBefore);
    const mail = (await mailsTo(user.email))[0];
    const link = /https?:\/\/[^\s"<>]+token=[^\s"<>]+/.exec(mail.Text)?.[0];
    expect(link, mail.Text).toBeTruthy();

    // A wrong password leaves the account where it is.
    const flow = await freshPage(browser);
    await flow.page.goto(link!);
    await expect(flow.page).toHaveURL((url) => matchPath(url.pathname)?.route === "/delete-account");
    await flow.page.getByLabel(tr.deleteAccountPage.email, { exact: true }).fill(user.email);
    await flow.page.getByLabel(tr.deleteAccountPage.password, { exact: true }).fill("Yanlis-Parola-1!");
    await flow.page.getByRole("button", { name: tr.deleteAccountPage.submit, exact: true }).click();
    await expect(alertWith(flow.page, tr.errors.deletionCredentialsInvalid)).toBeVisible();

    // The right credentials delete it and send the visitor home.
    await flow.page.getByLabel(tr.deleteAccountPage.password, { exact: true }).fill(user.password);
    await flow.page.getByRole("button", { name: tr.deleteAccountPage.submit, exact: true }).click();
    await expect(flow.page).toHaveURL((url) => matchPath(url.pathname)?.route === "/", { timeout: 15_000 });

    // The account is gone: no login, and the used link is dead.
    await submitCredentials(flow.page, user.email, user.password);
    await expect(flow.page.getByRole("alert").first()).toBeVisible();
    await expect(flow.page.locator("#main-content")).toHaveCount(0);

    await flow.page.goto(link!);
    await expect(flow.page.getByText(tr.deleteAccountPage.invalidTitle).or(flow.page.getByLabel(tr.deleteAccountPage.email, { exact: true }))).toBeVisible();
    if (await flow.page.getByLabel(tr.deleteAccountPage.email, { exact: true }).isVisible()) {
      await flow.page.getByLabel(tr.deleteAccountPage.email, { exact: true }).fill(user.email);
      await flow.page.getByLabel(tr.deleteAccountPage.password, { exact: true }).fill(user.password);
      await flow.page.getByRole("button", { name: tr.deleteAccountPage.submit, exact: true }).click();
      await expect(flow.page.getByRole("alert").first()).toBeVisible();
    }
    await flow.context.close();

    // The address is free again.
    const again = await freshPage(browser);
    await registerUser(again.page, user);
    await again.context.close();
  });

  test("silme sayfası bağlantısız açılırsa 'bağlantı geçersiz' der ve form göstermez", async ({ page }) => {
    await page.goto("/delete-account");
    await expect(page.getByText(tr.deleteAccountPage.invalidTitle)).toBeVisible();
    await expect(page.getByLabel(tr.deleteAccountPage.email, { exact: true })).toHaveCount(0);
  });
});
