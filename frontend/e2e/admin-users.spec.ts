import { test, expect, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { MEMBER_USER_FILE } from "./global-setup";
import { psql, promoteToAdmin } from "./db";
import { api, createProject, login, registerUser, uniqueUser } from "./helpers";

// The administration area on the real stack. Termination is the existing DISABLED state: reversible, nothing deleted.

async function newUser(browser: Browser, prefix: string) {
  const context = await browser.newContext({ locale: "tr-TR" });
  const page = await context.newPage();
  const user = uniqueUser(prefix);
  await registerUser(page, user);
  return { context, page, user };
}

async function newAdmin(browser: Browser) {
  const made = await newUser(browser, "adm");
  promoteToAdmin(made.user.email);
  await made.page.goto("/dashboard");
  await expect(made.page.locator("[data-admin-link]")).toBeVisible();
  return made;
}

const userRow = (page: Page, nickname: string) => page.locator(`tr[data-user-row="${nickname}"]`);

test("an administrator sees the users, searches on the server and ends then restores a membership (real 401, real login block)", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const target = await newUser(browser, "trg");
  await createProject(target.page, `Kalici Veri ${Date.now()}`);
  const targetId = ((await api(target.page, "GET", "/auth/me")).json as { id: string }).id;
  const projectRows = () => Number(psql(`SELECT count(*) FROM projects WHERE created_by = '${targetId}'`));
  expect(projectRows()).toBe(1);

  try {
    await admin.page.locator("[data-admin-link]").click();
    await expect(admin.page).toHaveURL(/\/tr\/yonetim\/kullanicilar$/);
    await expect(admin.page.locator("h1")).toHaveText("Kullanıcılar");

    // Server-side search: only the matching account comes back.
    const requests: string[] = [];
    admin.page.on("request", (request) => { if (request.url().includes("/admin/users")) requests.push(request.url()); });
    await admin.page.getByLabel("Kullanıcı ara").fill(target.user.nickname);
    await expect(userRow(admin.page, target.user.nickname)).toBeVisible();
    await expect(admin.page.locator("tr[data-user-row]")).toHaveCount(1);
    expect(requests.some((url) => url.includes(`search=${target.user.nickname}`))).toBe(true);
    const row = userRow(admin.page, target.user.nickname);
    await expect(row).toContainText(target.user.email);
    await expect(row).toContainText("Aktif");
    await expect(row).not.toContainText("passwordHash");

    // The confirmation says what happens and that it can be undone; it only unlocks with the exact name.
    await row.getByRole("button", { name: "Üyeliği sonlandır" }).click();
    const dialog = admin.page.getByRole("dialog");
    await expect(dialog).toContainText("geri alınabilir");
    await expect(dialog).toContainText("silinmez");
    const confirm = dialog.getByRole("button", { name: "Üyeliği sonlandır" });
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill(target.user.nickname.slice(0, -1));
    await expect(confirm).toBeDisabled();
    await dialog.getByRole("textbox").fill(target.user.nickname);
    await confirm.click();
    await expect(dialog).toHaveCount(0);
    await expect(userRow(admin.page, target.user.nickname)).toContainText("Sonlandırıldı");
    expect(psql(`SELECT account_status FROM users WHERE id = '${targetId}'`)).toBe("DISABLED");

    // The terminated user has an open session; the server really rejects it and the app sends them to sign in.
    expect((await api(target.page, "GET", "/auth/me")).status).toBe(401);
    await target.page.reload();
    await expect(target.page).toHaveURL(/\/tr\/giris/);
    // Signing in again fails with the generic message.
    await target.page.locator('input[name="email"]').fill(target.user.email);
    await target.page.locator('input[name="password"]').fill(target.user.password);
    await target.page.getByRole("button", { name: /^Giriş yap$/ }).click();
    await expect(target.page.locator("p[role=alert]")).toContainText("hatalı");
    await expect(target.page).toHaveURL(/\/tr\/giris/);

    // History is untouched: the account and its project still exist.
    expect(projectRows()).toBe(1);
    expect(psql(`SELECT count(*) FROM users WHERE id = '${targetId}'`)).toBe("1");

    // Re-activation restores sign-in and the project.
    await userRow(admin.page, target.user.nickname).getByRole("button", { name: "Yeniden etkinleştir" }).click();
    await admin.page.getByRole("dialog").getByRole("button", { name: "Yeniden etkinleştir" }).click();
    await expect(userRow(admin.page, target.user.nickname)).toContainText("Aktif");
    await login(target.page, target.user.email, target.user.password);
    const projects = (await api(target.page, "GET", "/projects")).json as { content?: unknown[]; items?: unknown[] } | unknown[];
    const list = Array.isArray(projects) ? projects : (projects.content ?? projects.items ?? []);
    expect(list.length).toBe(1);
    expect(psql(`SELECT account_status FROM users WHERE id = '${targetId}'`)).toBe("ACTIVE");
  } finally {
    await admin.context.close();
    await target.context.close();
  }
});

test("an administrator cannot end their own membership and the filter lists terminated accounts", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const other = await newUser(browser, "flt");
  try {
    await admin.page.goto("/admin/users");
    await admin.page.getByLabel("Kullanıcı ara").fill(admin.user.nickname);
    const own = userRow(admin.page, admin.user.nickname);
    await expect(own).toBeVisible();
    await expect(own).toContainText("Siz");
    await expect(own.getByRole("button")).toHaveCount(0);
    // The server refuses it anyway, with a stable code.
    const myId = ((await api(admin.page, "GET", "/auth/me")).json as { id: string }).id;
    const self = await api(admin.page, "POST", `/admin/users/${myId}/disable`);
    expect(self.status).toBe(409);
    expect((self.json as { code: string }).code).toBe("ADMIN_SELF_DENIED");

    const otherId = ((await api(other.page, "GET", "/auth/me")).json as { id: string }).id;
    expect((await api(admin.page, "POST", `/admin/users/${otherId}/disable`)).status).toBe(200);
    await admin.page.getByLabel("Kullanıcı ara").fill(other.user.nickname);
    await admin.page.getByRole("radio", { name: "Sonlandırıldı" }).click();
    await expect(userRow(admin.page, other.user.nickname)).toContainText("Sonlandırıldı");
    await admin.page.getByRole("radio", { name: "Aktif" }).click();
    await expect(admin.page.getByText("Kullanıcı bulunamadı")).toBeVisible();
  } finally {
    await admin.context.close();
    await other.context.close();
  }
});

test("a normal account has no admin link, is sent away from the page, and the API refuses it", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const member = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")) as { email: string; password: string };
  const context = await browser.newContext({ locale: "tr-TR" });
  const page = await context.newPage();
  try {
    await login(page, member.email, member.password);
    await expect(page.locator("[data-admin-link]")).toHaveCount(0);
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
    expect((await api(page, "GET", "/admin/users?search=a&status=ACTIVE")).status).toBe(403);
    const adminId = ((await api(admin.page, "GET", "/auth/me")).json as { id: string }).id;
    expect((await api(page, "POST", `/admin/users/${adminId}/disable`)).status).toBe(403);
    expect((await api(page, "GET", "/admin/analytics")).status).toBeGreaterThanOrEqual(403);
    expect(psql(`SELECT account_status FROM users WHERE id = '${adminId}'`)).toBe("ACTIVE");
  } finally {
    await context.close();
    await admin.context.close();
  }
});

test("admin data never survives a sign-out: the next account in the same tab sees nothing of it", async ({ browser }) => {
  const admin = await newAdmin(browser);
  const member = JSON.parse(readFileSync(MEMBER_USER_FILE, "utf8")) as { email: string; password: string };
  const page = admin.page;
  try {
    await page.goto("/admin/users");
    await expect(page.locator("tr[data-user-row]").first()).toBeVisible();

    // Sign out from the account menu (client-side, no reload), then sign in as a normal user in the same tab.
    await page.mouse.move(2, 2);
    await page.getByRole("button", { name: /Hesap menüsü/ }).click();
    await page.getByRole("menuitem", { name: "Çıkış yap", exact: true }).click();
    await expect(page).toHaveURL(/\/tr\/giris/);
    const adminRequests: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/api/v1/admin/")) adminRequests.push(request.url()); });
    await page.locator('input[name="email"]').fill(member.email);
    await page.locator('input[name="password"]').fill(member.password);
    await page.getByRole("button", { name: /^Giriş yap$/ }).click();
    await expect(page.locator("#main-content")).toBeVisible();
    await expect(page.locator("[data-admin-link]")).toHaveCount(0);

    // Client-side navigation to the admin page: nothing of the earlier cache may flash, and nothing is requested.
    await page.evaluate(() => {
      (window as unknown as { __seenAdminRows: number }).__seenAdminRows = 0;
      new MutationObserver(() => {
        if (document.querySelector("[data-user-row]")) (window as unknown as { __seenAdminRows: number }).__seenAdminRows += 1;
      }).observe(document.body, { childList: true, subtree: true });
      (window as unknown as { next: { router: { push: (href: string) => void } } }).next.router.push("/tr/yonetim/kullanicilar");
    });
    await expect(page).toHaveURL(/\/tr\/genel-bakis$/);
    expect(await page.evaluate(() => (window as unknown as { __seenAdminRows: number }).__seenAdminRows)).toBe(0);
    expect(adminRequests).toEqual([]);
  } finally {
    await admin.context.close();
  }
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`the user list fits ${width}px in both themes and every action is a real button`, async ({ browser }) => {
    const admin = await newAdmin(browser);
    const other = await newUser(browser, "rsp");
    try {
      const page = admin.page;
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const theme of ["light", "dark"]) {
        await page.addInitScript((value) => localStorage.setItem("theme", value), theme);
        await page.goto("/admin/users");
        await page.getByLabel("Kullanıcı ara").fill(other.user.nickname);
        const row = page.locator(`[data-user-row="${other.user.nickname}"]:visible`);
        await expect(row).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        const action = row.getByRole("button", { name: "Üyeliği sonlandır" });
        await expect(action).toBeVisible();
        expect((await action.boundingBox())!.height).toBeGreaterThanOrEqual(36);
        // Keyboard: the button opens the confirmation and Escape closes it without doing anything.
        await action.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(row).toContainText("Aktif");
      }
    } finally {
      await admin.context.close();
      await other.context.close();
    }
  });
}
