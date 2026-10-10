import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { matchPath } from "../src/i18n/routing";
import tr from "../src/i18n/messages/tr.json";
import en from "../src/i18n/messages/en.json";
import de from "../src/i18n/messages/de.json";
import { REJECTED_STATE } from "./consent-state";
import { promoteToAdmin } from "./db";
import { MEMBER_USER_FILE } from "./global-setup";
import {
  adminAuthenticator,
  adminSignIn,
  api,
  login,
  nextAdminCode,
  registerUser,
  rememberAdminAuthenticator,
  submitAdminCredentials,
  uniqueUser,
} from "./helpers";
import { totpCode } from "./totp";

// The separate administrator sign-in (/pd-admin) on the real stack: password step, mandatory authenticator
// enrollment on the first sign-in, authenticator challenge afterwards, the administrator-verified session and the
// isolation from the regular sign-in. The authenticator is played by e2e/totp.ts with the key the enrollment screen shows.

const t = tr.adminLogin;
const alertWith = (page: Page, text: string) => page.getByRole("alert").filter({ hasText: text }).first();
const heading = (page: Page, title: string) => page.getByRole("heading", { level: 1, name: title, exact: true });
const inPanel = (url: URL) => !!matchPath(url.pathname)?.route.startsWith("/admin");

async function freshContext(browser: Browser, options: { locale?: string; width?: number; height?: number } = {}) {
  return browser.newContext({
    storageState: REJECTED_STATE,
    locale: options.locale ?? "tr-TR",
    viewport: options.width ? { width: options.width, height: options.height ?? 900 } : undefined,
  });
}

/** A registered account promoted to ADMIN. The page still holds the regular session it got at registration. */
async function newAdminAccount(browser: Browser, prefix: string) {
  const context = await freshContext(browser);
  const page = await context.newPage();
  const user = uniqueUser(prefix);
  await registerUser(page, user);
  promoteToAdmin(user.email);
  return { context, page, user };
}

async function signOut(page: Page) {
  await page.mouse.move(2, 2);
  await page.getByRole("button", { name: /Hesap menüsü/ }).click();
  await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/giris/);
}

/** A code the server will refuse: not one of the three steps it accepts. */
function wrongCode(secret: string) {
  const accepted = new Set([-1, 0, 1].map((offset) => totpCode(secret, offset)));
  return ["000000", "111111", "222222"].find((code) => !accepted.has(code))!;
}

async function openTotpStep(page: Page, user: { email: string; password: string }) {
  await page.goto("/pd-admin");
  await submitAdminCredentials(page, user);
  await expect(heading(page, t.totp.title)).toBeVisible();
}

test.describe("regular pages know nothing of the administrator sign-in", () => {
  test("a regular account signs in on /login and nothing there mentions an administrator area", async ({ browser }) => {
    const member = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")) as { email: string; password: string };
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      for (const path of ["/login", "/register", "/forgot-password"]) {
        await page.goto(path);
        await expect(page.getByRole("link", { name: /Ana sayfa|PDA/ }).first()).toBeVisible();
        const text = (await page.locator("body").innerText()).toLowerCase();
        expect(text, path).not.toMatch(/yönetici|administrator|pd-admin/);
        expect(await page.locator('a[href*="pd-admin"], [data-admin-link]').count(), path).toBe(0);
      }
      await login(page, member.email, member.password);
      await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
      await expect(page.locator("[data-admin-link]")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("/pd-admin is linked from no public page, robots.txt, the sitemap or llms.txt, and is never indexed", async ({ browser, request }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      for (const path of ["/", "/login", "/register", "/forgot-password", "/faq", "/about", "/contact", "/privacy", "/cookies", "/accessibility"]) {
        await page.goto(path);
        await page.waitForLoadState("domcontentloaded");
        const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
        expect(hrefs.filter((href) => /pd-admin/i.test(href)), path).toEqual([]);
      }
      for (const file of ["/robots.txt", "/sitemap.xml", "/llms.txt"]) {
        const response = await request.get(file);
        expect(response.status(), file).toBe(200);
        expect(await response.text(), file).not.toMatch(/pd-admin/i);
      }
      await page.goto("/pd-admin");
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      expect((await request.get("/pd-admin")).headers()["x-robots-tag"]).toContain("noindex");
    } finally {
      await context.close();
    }
  });
});

test.describe("the sign-in page", () => {
  test("anonymous visitors see the dedicated administrator sign-in, with none of the regular sign-in's links", async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await page.goto("/pd-admin");
      await expect(page).toHaveURL(/\/pd-admin$/);
      await expect(heading(page, t.title)).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(t.metaTitle));
      await expect(page.locator('input[name="email"]')).toBeVisible();
      await expect(page.locator('input[name="password"]')).toBeVisible();
      await expect(page.getByRole("button", { name: t.submit, exact: true })).toBeVisible();
      // No register, forgot-password, remember-me or provider sign-in on this page.
      const card = page.locator("section[aria-labelledby=auth-card-title]");
      await expect(card.locator('a[href*="kayit"], a[href*="register"], a[href*="sifremi-unuttum"], a[href*="forgot"]')).toHaveCount(0);
      await expect(card.getByText(/Google|GitHub|Beni hatırla/)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("a regular session never grants admin access: the sign-in still shows and the admin API says 403", async ({ browser }) => {
    const member = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")) as { email: string; password: string };
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await login(page, member.email, member.password);
      await page.goto("/pd-admin");
      await expect(heading(page, t.title)).toBeVisible();
      await expect(page).toHaveURL(/\/pd-admin$/);
      expect((await api(page, "GET", "/admin/users?search=a&status=ACTIVE")).status).toBe(403);
      expect((await api(page, "GET", "/admin/analytics")).status).toBe(403);
      expect((await api(page, "GET", "/auth/me")).json).toMatchObject({ globalRole: "USER", adminVerified: false });
      // The panel itself turns a regular account away before rendering anything.
      await page.goto("/admin/users");
      await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
      await expect(page.locator("[data-user-row]")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("the page follows the language (cookie, then Accept-Language) and the language switch stays on /pd-admin", async ({ browser }) => {
    const titles = { tr: tr.adminLogin.title, en: en.adminLogin.title, de: de.adminLogin.title };
    // No cookie: the browser's language decides.
    for (const [locale, accept] of [["de", "de-DE"], ["en", "en-US"], ["tr", "tr-TR"]] as const) {
      const context = await freshContext(browser, { locale: accept });
      const page = await context.newPage();
      await page.goto("/pd-admin");
      await expect(heading(page, titles[locale])).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await context.close();
    }
    // The cookie wins over the browser's language.
    const context = await freshContext(browser, { locale: "tr-TR" });
    await context.addCookies([{ name: "NEXT_LOCALE", value: "en", url: "http://localhost:3000" }]);
    const page = await context.newPage();
    try {
      await page.goto("/pd-admin");
      await expect(heading(page, titles.en)).toBeVisible();
      await expect(page).toHaveTitle(new RegExp(en.adminLogin.metaTitle));
      // Switching language reloads the same address (it has no localized form) in the new language.
      await page.getByRole("button", { name: en.common.language.label }).click();
      await page.getByRole("menuitem", { name: "Deutsch" }).click();
      await expect(heading(page, titles.de)).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/pd-admin$/);
    } finally {
      await context.close();
    }
  });
});

test.describe.serial("administrator lifecycle", () => {
  let admin: Awaited<ReturnType<typeof newAdminAccount>>;
  let spare: Awaited<ReturnType<typeof newAdminAccount>>;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    admin = await newAdminAccount(browser, "padm");
    spare = await newAdminAccount(browser, "pspr");
  });

  test.afterAll(async () => {
    await admin?.context.close();
    await spare?.context.close();
  });

  test("an administrator on the regular /login gets the generic error and no session", async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await page.goto("/login");
      await page.locator('input[name="email"]').fill(spare.user.email);
      await page.locator('input[name="password"]').fill(spare.user.password);
      await page.getByRole("button", { name: /^Giriş yap$/ }).click();
      await expect(alertWith(page, tr.errors.invalidCredentials)).toBeVisible();
      await expect(page).toHaveURL(/\/tr\/giris/);
      expect((await api(page, "GET", "/auth/me")).status).toBe(401);
      expect((await context.cookies()).some((cookie) => cookie.name === "PDA_ACCESS")).toBe(false);
      // A wrong password reads exactly the same: nothing tells the two apart.
      await page.locator('input[name="password"]').fill("Wrong-password-1!");
      await page.getByRole("button", { name: /^Giriş yap$/ }).click();
      await expect(alertWith(page, tr.errors.invalidCredentials)).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("an older administrator session is sent to /pd-admin, the admin API refuses it and no admin link is offered", async () => {
    const { page } = admin;
    await page.goto("/dashboard");
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("[data-admin-link]")).toHaveCount(0);
    expect((await api(page, "GET", "/auth/me")).json).toMatchObject({ globalRole: "ADMIN", adminVerified: false });
    const refused = await api(page, "GET", "/admin/users?search=a&status=ACTIVE");
    expect(refused.status).toBe(403);
    expect(refused.json).toMatchObject({ code: "admin_reauthentication_required" });

    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/pd-admin\?reason=reauthenticate/);
    await expect(heading(page, t.title)).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: t.notices.reauthenticate })).toBeVisible();
  });

  test("first sign-in: QR, manual key and instructions; a wrong code activates nothing; the right code shows the backup codes once", async () => {
    test.setTimeout(120_000);
    const { page, user, context } = admin;
    await page.goto("/pd-admin");
    await submitAdminCredentials(page, user);

    // Enrollment step: heading takes focus, ordered instructions, QR with a label, manual key with a copy button.
    const title = heading(page, t.enroll.title);
    await expect(title).toBeVisible();
    await expect(title).toBeFocused();
    await expect(page.locator("ol[role=list] > li")).toHaveCount(3);
    await expect(page.getByText(t.enroll.step1)).toBeVisible();
    await expect(page.getByText(t.enroll.step2)).toBeVisible();
    await expect(page.getByText(t.enroll.step3)).toBeVisible();
    await expect(page.getByRole("img", { name: t.enroll.qrLabel })).toBeVisible();
    const key = page.getByTestId("admin-manual-key");
    const secret = (await key.innerText()).replace(/\s+/g, "");
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    await expect(page.getByRole("button", { name: t.enroll.copy })).toBeVisible();
    const code = page.getByLabel(t.enroll.code, { exact: true });
    await expect(code).toHaveAttribute("inputmode", "numeric");
    await expect(code).toHaveAttribute("autocomplete", "one-time-code");

    // The key lives in the page's memory only.
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(stored).not.toContain(secret);

    // A wrong code is refused, says so in an alert, and enables nothing.
    const authenticator = { secret, recoveryCodes: [] as string[], lastStep: -1 };
    await code.fill(wrongCode(secret));
    await page.getByRole("button", { name: t.enroll.submit, exact: true }).click();
    await expect(alertWith(page, tr.errors.twoFactorCodeInvalid)).toBeVisible();
    await expect(title).toBeVisible();
    expect((await api(page, "GET", "/auth/me")).json).toMatchObject({ adminVerified: false }); // still only the old regular session
    expect(await context.cookies().then((cookies) => cookies.some((cookie) => cookie.name === "PDA_ADMIN_ENROLL"))).toBe(true);

    // Starting over: still no authenticator on the account, so enrollment is offered again (with a fresh key).
    await page.getByRole("button", { name: t.enroll.back }).click();
    await expect(heading(page, t.title)).toBeVisible();
    await submitAdminCredentials(page, user);
    await expect(heading(page, t.enroll.title)).toBeVisible();
    const secondSecret = (await page.getByTestId("admin-manual-key").innerText()).replace(/\s+/g, "");
    authenticator.secret = secondSecret;

    // The first right code opens the session and shows the ten backup codes, once.
    await page.getByLabel(t.enroll.code, { exact: true }).fill(await nextAdminCode(page, authenticator));
    await page.getByRole("button", { name: t.enroll.submit, exact: true }).click();
    await expect(heading(page, t.codes.title)).toBeVisible();
    await expect(heading(page, t.codes.title)).toBeFocused();
    const codes = (await page.getByTestId("admin-recovery-codes").locator("li").allInnerTexts()).map((item) => item.trim());
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    authenticator.recoveryCodes = codes;
    rememberAdminAuthenticator(user.email, authenticator);

    // The session already exists and is administrator-verified; the secret and the codes are in no readable place.
    const me = await api(page, "GET", "/auth/me");
    expect(me.json).toMatchObject({ globalRole: "ADMIN", adminVerified: true });
    const status = await api(page, "GET", "/auth/2fa");
    expect(status.json).toMatchObject({ enabled: true });
    for (const body of [JSON.stringify(me.json), JSON.stringify(status.json)]) {
      expect(body).not.toContain(secondSecret);
      expect(body).not.toContain(codes[0]);
    }
    const afterwards = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + document.cookie);
    expect(afterwards).not.toContain(secondSecret);
    expect(afterwards).not.toContain(codes[0]);
    expect(afterwards).not.toMatch(/PDA_ACCESS|PDA_REFRESH|PDA_ADMIN/);

    // Only the confirmation continues to the panel.
    await expect(page).toHaveURL(/\/pd-admin$/);
    await page.getByRole("button", { name: t.codes.saved, exact: true }).click();
    await expect(page).toHaveURL(/\/tr\/yonetim\/kullanicilar$/);
    await expect(page.locator("h1")).toHaveText("Kullanıcılar");
    await expect(page.locator("[data-admin-link]")).toBeVisible();
    expect(await page.evaluate(() => document.body.innerText)).not.toContain(codes[0]);

    // A signed-in administrator who opens /pd-admin goes straight to the panel.
    await page.goto("/pd-admin");
    await expect(page).toHaveURL(/\/tr\/yonetim\/kullanicilar$/);

    // Two-step verification is mandatory: the account's own switch is refused for an administrator.
    const disable = await api(page, "POST", "/auth/2fa/disable", { password: user.password, code: totpCode(secondSecret, 2) });
    expect(disable.status).toBe(403);
    expect(disable.json).toMatchObject({ code: "admin_two_factor_required" });
    await page.goto("/account");
    await expect(page.getByText(tr.securityFlow.twoFactor.adminRequired)).toBeVisible();
    await expect(page.getByRole("button", { name: tr.securityFlow.twoFactor.disable, exact: true })).toHaveCount(0);
  });

  test("later sign-ins ask for the authenticator: password alone opens nothing, a wrong code opens nothing, the right code opens the panel", async ({ browser }) => {
    test.setTimeout(120_000);
    const { page, user } = admin;
    await signOut(page);
    const authenticator = adminAuthenticator(user.email);

    const context = await freshContext(browser);
    const fresh = await context.newPage();
    try {
      await openTotpStep(fresh, user);
      const title = heading(fresh, t.totp.title);
      await expect(title).toBeFocused();
      const field = fresh.getByLabel(t.totp.code, { exact: true });
      await expect(field).toHaveAttribute("inputmode", "numeric");
      await expect(field).toHaveAttribute("autocomplete", "one-time-code");

      // Password only (the ticket stage) opens neither a session nor the admin API.
      expect((await api(fresh, "GET", "/auth/me")).status).toBe(401);
      for (const path of ["/admin/users?search=a&status=ACTIVE", "/admin/analytics", "/admin/overview"]) {
        const refused = await api(fresh, "GET", path);
        expect([401, 403], path).toContain(refused.status);
      }
      expect((await context.cookies()).some((cookie) => cookie.name === "PDA_ACCESS")).toBe(false);

      // A wrong code: alert, still no session, same step.
      await field.fill(wrongCode(authenticator.secret));
      await fresh.getByRole("button", { name: t.totp.submit, exact: true }).click();
      await expect(alertWith(fresh, tr.errors.twoFactorCodeInvalid)).toBeVisible();
      await expect(field).toBeFocused();
      expect((await api(fresh, "GET", "/auth/me")).status).toBe(401);
      await expect(fresh).toHaveURL(/\/pd-admin$/);

      // Spaces inside a pasted code are fine.
      const right = await nextAdminCode(fresh, authenticator);
      await field.fill(`${right.slice(0, 3)} ${right.slice(3)}`);
      await fresh.getByRole("button", { name: t.totp.submit, exact: true }).click();
      await expect(fresh).toHaveURL(inPanel, { timeout: 15_000 });
      await expect(fresh).toHaveURL(/\/tr\/yonetim\/kullanicilar$/);
      expect((await api(fresh, "GET", "/admin/users?search=a&status=ACTIVE")).status).toBe(200);
      expect((await api(fresh, "GET", "/auth/me")).json).toMatchObject({ adminVerified: true });
    } finally {
      await context.close();
    }
  });

  test("an expired ticket sends the person back to the password step with a message", async ({ browser }) => {
    const { user } = admin;
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await openTotpStep(page, user);
      await context.clearCookies({ name: "PDA_ADMIN_MFA" });
      // The ticket is checked before the code, so the code is never looked at (and no authenticator step is used up).
      await page.getByLabel(t.totp.code, { exact: true }).fill(totpCode(adminAuthenticator(user.email).secret));
      await page.getByRole("button", { name: t.totp.submit, exact: true }).click();
      await expect(heading(page, t.title)).toBeVisible();
      await expect(heading(page, t.title)).toBeFocused();
      await expect(page.getByRole("status").filter({ hasText: t.notices.ticketExpired })).toBeVisible();
      expect((await api(page, "GET", "/auth/me")).status).toBe(401);
    } finally {
      await context.close();
    }
  });

  test("a backup code signs in once; the same code is refused the second time", async ({ browser }) => {
    test.setTimeout(120_000);
    const { user } = admin;
    const authenticator = adminAuthenticator(user.email);
    const backup = authenticator.recoveryCodes.shift()!; // spent below; the helper must not offer it again
    for (const attempt of ["first", "second"] as const) {
      const context = await freshContext(browser);
      const page = await context.newPage();
      try {
        await openTotpStep(page, user);
        await page.getByRole("button", { name: t.totp.useBackup, exact: true }).click();
        await expect(page.getByText(t.totp.backupSubtitle)).toBeVisible();
        const field = page.getByLabel(t.totp.backupCode, { exact: true });
        await expect(field).toBeFocused();
        await field.fill(backup);
        await page.getByRole("button", { name: t.totp.submit, exact: true }).click();
        if (attempt === "first") {
          await expect(page).toHaveURL(/\/tr\/yonetim\/kullanicilar$/, { timeout: 15_000 });
        } else {
          await expect(alertWith(page, tr.errors.twoFactorCodeInvalid)).toBeVisible();
          expect((await api(page, "GET", "/auth/me")).status).toBe(401);
          // The ticket survives a wrong code: the authenticator still works in the same step.
          await page.getByRole("button", { name: t.totp.useApp, exact: true }).click();
          await page.getByLabel(t.totp.code, { exact: true }).fill(await nextAdminCode(page, authenticator));
          await page.getByRole("button", { name: t.totp.submit, exact: true }).click();
          await expect(page).toHaveURL(/\/tr\/yonetim\/kullanicilar$/, { timeout: 15_000 });
        }
      } finally {
        await context.close();
      }
    }
  });

  test("signing out ends the administrator session: the panel, the admin API and the old cookies are gone", async ({ browser }) => {
    test.setTimeout(120_000);
    const { user } = admin;
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await adminSignIn(page, user, { viaBackupCode: true });
      const oldAccess = (await context.cookies()).find((cookie) => cookie.name === "PDA_ACCESS")!.value;
      await signOut(page);
      expect((await api(page, "GET", "/admin/users?search=a&status=ACTIVE")).status).toBe(401);
      const replay = await fetch("http://localhost:8080/api/v1/admin/users?search=a&status=ACTIVE", { headers: { Cookie: `PDA_ACCESS=${oldAccess}` } });
      expect(replay.status).toBe(401);
      await page.goto("/admin/users");
      await expect(page).toHaveURL(/\/tr\/giris/);
      await page.goto("/pd-admin");
      await expect(heading(page, t.title)).toBeVisible();
      await expect(page).toHaveURL(/\/pd-admin$/);
      const names = (await context.cookies()).map((cookie) => cookie.name);
      expect(names.filter((name) => /^PDA_(ACCESS|REFRESH|SESSION|ADMIN)/.test(name))).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test("an administrator session that ends inside the panel returns to /pd-admin with the notice", async ({ browser }) => {
    test.setTimeout(120_000);
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await adminSignIn(page, admin.user, { viaBackupCode: true });
      await context.clearCookies({ name: "PDA_ACCESS" });
      await context.clearCookies({ name: "PDA_REFRESH" });
      await page.getByRole("link", { name: "Analitik", exact: true }).click();
      await expect(page).toHaveURL(/\/pd-admin\?reason=session-expired/, { timeout: 15_000 });
      await expect(page.getByRole("status").filter({ hasText: t.notices.sessionExpired })).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("keyboard only: the password step is completed with Tab and Enter and the enrollment step is reachable in order", async ({ browser }) => {
    const context = await freshContext(browser);
    const page = await context.newPage();
    try {
      await page.goto("/pd-admin");
      await page.locator('input[name="email"]').focus();
      await page.keyboard.type(spare.user.email);
      await page.keyboard.press("Tab");
      await page.keyboard.type(spare.user.password);
      await page.keyboard.press("Enter");
      const title = heading(page, t.enroll.title);
      await expect(title).toBeFocused();
      // First stop after the heading: the copy button; then the code field.
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: t.enroll.copy })).toBeFocused();
      await page.keyboard.press("Tab");
      const code = page.getByLabel(t.enroll.code, { exact: true });
      await expect(code).toBeFocused();
      // A refused code keeps the keyboard in the field.
      const secret = (await page.getByTestId("admin-manual-key").innerText()).replace(/\s+/g, "");
      await page.keyboard.type(wrongCode(secret));
      await page.keyboard.press("Enter");
      await expect(alertWith(page, tr.errors.twoFactorCodeInvalid)).toBeVisible();
      await expect(code).toBeFocused();
      // Shift+Tab walks back; the back link is the last stop, Enter returns to the password step.
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: t.enroll.back })).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(heading(page, t.title)).toBeFocused();
    } finally {
      await context.close();
    }
  });

  for (const width of [320, 390, 768, 1024, 1440]) {
    test(`all steps fit ${width}px in light and dark, with 44px targets`, async ({ browser }) => {
      test.setTimeout(120_000);
      const context = await freshContext(browser, { width });
      const page = await context.newPage();
      await page.emulateMedia({ reducedMotion: "reduce" });
      try {
        for (const theme of ["light", "dark"] as const) {
          await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
          const checkStep = async (name: string) => {
            await page.waitForTimeout(150);
            expect(await page.evaluate(() => document.documentElement.scrollWidth), `${name} ${theme} overflow`).toBeLessThanOrEqual(width);
            const targets = page.locator("section[aria-labelledby=auth-card-title] :is(button, a, input):visible");
            for (let index = 0; index < (await targets.count()); index++) {
              const box = await targets.nth(index).boundingBox();
              expect(box!.height, `${name} ${theme} target ${index}`).toBeGreaterThanOrEqual(43.5);
            }
          };

          await page.goto("/pd-admin");
          await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
          await expect(heading(page, t.title)).toBeVisible();
          await checkStep("credentials");

          await submitAdminCredentials(page, spare.user);
          await expect(heading(page, t.enroll.title)).toBeVisible();
          await expect(page.getByRole("img", { name: t.enroll.qrLabel })).toBeVisible();
          await checkStep("enrollment");

          await page.goto("/pd-admin");
          await submitAdminCredentials(page, admin.user);
          await expect(heading(page, t.totp.title)).toBeVisible();
          await checkStep("authenticator");
        }
      } finally {
        await context.close();
      }
    });
  }
});
